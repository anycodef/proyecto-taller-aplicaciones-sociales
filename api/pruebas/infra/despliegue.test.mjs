import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { verificarDespliegue } from '../../../infra/scripts/verificar-despliegue.mjs';
import { ensayarCaida } from '../../../infra/scripts/ensayo-caida.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');
const ejecutar = promisify(execFile);
const CLAVE = 'clave-de-suscripcion-de-prueba-0123456789';

function servidor(manejador) {
  return new Promise((listo) => {
    const s = createServer(manejador);
    s.listen(0, '127.0.0.1', () => listo({ url: `http://127.0.0.1:${s.address().port}`, cerrar: () => new Promise((c) => s.close(c)) }));
  });
}

async function puertoCerrado() {
  const s = await servidor(() => {});
  await s.cerrar();
  return s.url;
}

// APIM y Static Web Apps simulados. `malo` reproduce cada fallo que la verificacion debe detectar.
async function entorno({ malo = false } = {}) {
  const web = await servidor((peticion, respuesta) => {
    const cabeceras = { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000' };
    if (!malo) cabeceras['content-security-policy'] = "default-src 'self'";
    respuesta.writeHead(peticion.url === '/' || peticion.url === '/acceso/equipo' ? 200 : 404, cabeceras).end('<!doctype html>');
  });
  const origenWeb = new URL(web.url).origin;
  const api = await servidor((peticion, respuesta) => {
    if (peticion.url === '/estado/') {
      respuesta.writeHead(200, { 'content-type': 'application/json', 'cache-control': malo ? 'public' : 'no-store' }).end('{"estado":"disponible"}');
    } else if (peticion.url === '/v1/yo' && peticion.method === 'OPTIONS') {
      const origen = peticion.headers.origin;
      const permitido = malo ? '*' : origen === origenWeb ? origen : undefined;
      respuesta.writeHead(200, permitido ? { 'access-control-allow-origin': permitido } : {}).end();
    } else if (peticion.url === '/v1/yo') {
      respuesta.writeHead(malo && peticion.headers['ocp-apim-subscription-key'] ? 200 : 401).end('{}');
    } else respuesta.writeHead(404).end();
  });
  const http = malo ? await servidor((_, r) => r.writeHead(200).end('{}')) : { url: await puertoCerrado(), cerrar: async () => {} };
  return {
    opciones: { urlApi: `${api.url}/v1`, urlWeb: web.url, urlHttp: `${http.url}/v1`, clave: CLAVE, tiempo: 3000 },
    cerrar: () => Promise.all([web.cerrar(), api.cerrar(), http.cerrar()]),
  };
}

test('RF-1201: el CI y el despliegue instalan tarea3 y el lint de api se lanza desde la raiz', () => {
  for (const flujo of ['.github/workflows/ci.yml', '.github/workflows/despliegue.yml']) {
    assert.match(leer(flujo), /npm ci && npm ci --prefix api && npm ci --prefix tarea3/, flujo);
    assert.match(leer(flujo), /tarea3\/package-lock\.json/, flujo);
  }
  assert.equal(JSON.parse(leer('api/package.json')).scripts.lint, 'cd .. && eslint api');
});

test('RF-1202: el CI publica frontend-web solo desde su propia ejecucion en main y con la URL de la API', () => {
  const ci = leer('.github/workflows/ci.yml');
  const web = ci.slice(ci.indexOf('\n  web:'));
  assert.match(web, /needs: verificar/);
  assert.match(web, /github\.ref == 'refs\/heads\/main'/);
  assert.match(web, /contains\(github\.workflow_ref, '\.github\/workflows\/ci\.yml@'\)/);
  assert.match(web, /vars\.FRONTEND_HABILITADO == 'true'/);
  assert.match(web, /EXPO_PUBLIC_URL_API: \$\{\{ vars\.URL_API_PUBLICA \}\}/);
  assert.match(web, /EXPO_PUBLIC_CLAVE_APIM: \$\{\{ secrets\.CLAVE_APIM_WEB \}\}/);
  assert.match(web, /https:\/\/\*\/v1\) ;;[\s\S]*exit 1/);
  assert.match(web, /test -f frontend-web\/staticwebapp\.config\.json/);
  assert.match(web, /name: frontend-web/);
  assert.ok(existsSync(join(raiz, 'public/staticwebapp.config.json')));
  assert.match(leer('.github/workflows/despliegue-web.yml'), /o\["path"\]=="\.github\/workflows\/ci\.yml"/);
});

test('RF-1203: la verificacion posterior pasa contra un despliegue correcto', async () => {
  const e = await entorno();
  try {
    const resultados = await verificarDespliegue(e.opciones);
    assert.deepEqual(resultados.filter((r) => r.estado !== 'PASÓ'), []);
    assert.deepEqual(resultados.map((r) => r.id), ['estado', 'sin-credencial', 'sin-jwt', 'solo-https', 'cors-web', 'cors-ajeno', 'web-cabeceras', 'web-ruta-interna']);
  } finally {
    await e.cerrar();
  }
});

test('RF-1203: la verificacion posterior detecta cache, JWT, HTTP, CORS y cabeceras incorrectos', async () => {
  const e = await entorno({ malo: true });
  try {
    const fallidas = (await verificarDespliegue(e.opciones)).filter((r) => r.estado === 'FALLÓ').map((r) => r.id);
    assert.deepEqual(fallidas, ['estado', 'sin-jwt', 'solo-https', 'cors-web', 'cors-ajeno', 'web-cabeceras']);
  } finally {
    await e.cerrar();
  }
});

test('RF-1203 RNF-1202: la CLI termina con 1 ante fallos y nunca imprime la clave', async () => {
  const e = await entorno({ malo: true });
  try {
    const argumentos = ['infra/scripts/verificar-despliegue.mjs', '--api', e.opciones.urlApi, '--web', e.opciones.urlWeb, '--http', e.opciones.urlHttp, '--tiempo', '3000'];
    const error = await ejecutar(process.execPath, argumentos, { cwd: raiz, env: { ...process.env, VERIFICAR_CLAVE_APIM: CLAVE } }).catch((fallo) => fallo);
    assert.equal(error.code, 1);
    assert.ok(!`${error.stdout}${error.stderr}`.includes(CLAVE));
    assert.match(error.stdout, /FALLÓ\s+solo-https/);
  } finally {
    await e.cerrar();
  }
});

// Doble de Azure CLI para el ensayo: guarda el estado de la Function App en un JSON.
function dobleAzEnsayo(directorio, urlEstado, { fallaAlertas = false } = {}) {
  const estado = join(directorio, 'estado.json');
  writeFileSync(estado, JSON.stringify({ detenida: false, eventos: [] }));
  const regla = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Insights/metricAlerts/sigecat-disponibilidad-prod-caida';
  const az = join(directorio, 'az');
  writeFileSync(az, `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2).join(' ');
const e = JSON.parse(fs.readFileSync(${JSON.stringify(estado)}, 'utf8'));
const guardar = () => fs.writeFileSync(${JSON.stringify(estado)}, JSON.stringify(e));
const salir = (valor) => { process.stdout.write(JSON.stringify(valor)); process.exit(0); };
if (a.startsWith('deployment group show')) salir({ nombreFunciones: { value: 'func-sigecat' }, urlEstado: { value: ${JSON.stringify(urlEstado)} } });
if (a.startsWith('account show')) salir({ id: 'sub' });
if (a.startsWith('monitor metrics alert list')) salir([{ name: 'sigecat-disponibilidad-prod-caida', id: ${JSON.stringify(regla)}, enabled: true }]);
if (a.startsWith('functionapp stop')) { e.detenida = true; e.detenidaEn = new Date().toISOString(); e.eventos.push('stop'); guardar(); salir(null); }
if (a.startsWith('functionapp start')) { e.detenida = false; e.eventos.push('start'); guardar(); salir(null); }
if (a.startsWith('rest')) {
  if (${fallaAlertas} && e.detenida) { console.error('fallo simulado'); process.exit(1); }
  if (!e.detenidaEn) salir({ value: [] });
  salir({ value: [{ properties: { essentials: { alertRule: ${JSON.stringify(regla.toUpperCase())}, monitorCondition: e.detenida ? 'Fired' : 'Resolved', startDateTime: e.detenidaEn } } }] });
}
console.error('comando no simulado: ' + a); process.exit(9);
`);
  chmodSync(az, 0o755);
  return { az, eventos: () => JSON.parse(readFileSync(estado, 'utf8')).eventos, detenida: () => JSON.parse(readFileSync(estado, 'utf8')).detenida };
}

async function estadoSegunDoble(directorio) {
  return servidor((_, respuesta) => {
    const ruta = join(directorio, 'estado.json');
    const detenida = existsSync(ruta) && JSON.parse(readFileSync(ruta, 'utf8')).detenida;
    if (detenida) respuesta.writeHead(503, { 'cache-control': 'no-store' }).end('{"estado":"no disponible"}');
    else respuesta.writeHead(200, { 'cache-control': 'no-store' }).end('{"estado":"disponible"}');
  });
}

const intervalos = { intervaloEstado: 20, intervaloAlerta: 20, limiteCaida: 3000, limiteAlerta: 3000 };

test('RF-1204: el ensayo registra caida, alerta, reinicio, recuperacion y resolucion en orden', async () => {
  const directorio = mkdtempSync(join(tmpdir(), 'sigecat-ensayo-'));
  const estado = await estadoSegunDoble(directorio);
  const doble = dobleAzEnsayo(directorio, `${estado.url}/estado/`);
  process.env.AZ_BIN = doble.az;
  try {
    const evidencia = await ensayarCaida({ grupo: 'rg', ...intervalos });
    assert.equal(evidencia.resultado, 'completo', evidencia.error);
    const orden = ['inicio', 'functionsDetenida', 'caidaObservada', 'alertaDisparada', 'functionsReiniciada', 'recuperada', 'alertaResuelta'];
    assert.deepEqual(Object.keys(evidencia.hitos), orden);
    const horas = orden.map((h) => Date.parse(evidencia.hitos[h]));
    assert.deepEqual([...horas].sort((a, b) => a - b), horas);
    assert.deepEqual(doble.eventos(), ['stop', 'start']);
    assert.equal(evidencia.regla, 'sigecat-disponibilidad-prod-caida');
  } finally {
    delete process.env.AZ_BIN;
    await estado.cerrar();
  }
});

test('RF-1204: si la alerta no se puede consultar, el ensayo reinicia la Function App y queda incompleto', async () => {
  const directorio = mkdtempSync(join(tmpdir(), 'sigecat-ensayo-'));
  const estado = await estadoSegunDoble(directorio);
  const doble = dobleAzEnsayo(directorio, `${estado.url}/estado/`, { fallaAlertas: true });
  process.env.AZ_BIN = doble.az;
  try {
    const evidencia = await ensayarCaida({ grupo: 'rg', ...intervalos });
    assert.equal(evidencia.resultado, 'incompleto');
    assert.ok(evidencia.error);
    assert.deepEqual(doble.eventos(), ['stop', 'start']);
    assert.equal(doble.detenida(), false);
    assert.ok(evidencia.hitos.functionsReiniciada);
  } finally {
    delete process.env.AZ_BIN;
    await estado.cerrar();
  }
});

test('RF-1204: sin --confirmar el ensayo no llama a Azure', async () => {
  const directorio = mkdtempSync(join(tmpdir(), 'sigecat-ensayo-'));
  const doble = dobleAzEnsayo(directorio, 'http://127.0.0.1:1/estado/');
  const error = await ejecutar(process.execPath, ['infra/scripts/ensayo-caida.mjs'], { cwd: raiz, env: { ...process.env, AZ_BIN: doble.az } }).catch((fallo) => fallo);
  assert.equal(error.code, 2);
  assert.match(error.stderr, /--confirmar/);
  assert.deepEqual(doble.eventos(), []);
});

// Dobles de az y gh que registran cada llamada en un archivo JSONL.
function doblesPreparacion(directorio, { existe = false } = {}) {
  const registro = join(directorio, 'llamadas.jsonl');
  const comun = `const fs = require('node:fs');
const args = process.argv.slice(2);
let entrada = '';
try { if (args.includes('--input')) entrada = fs.readFileSync(0, 'utf8'); } catch {}
fs.appendFileSync(${JSON.stringify(registro)}, JSON.stringify({ bin: process.argv[1].split('/').pop(), args, entrada }) + '\\n');
const a = args.join(' ');
const decir = (t) => { if (t !== undefined) process.stdout.write(t + '\\n'); process.exit(0); };
`;
  writeFileSync(join(directorio, 'az'), `#!/usr/bin/env node
${comun}
if (a.startsWith('account show')) decir(a.includes('tenantId') ? 'inquilino-prueba' : a.includes('name') ? 'Suscripcion de prueba' : 'suscripcion-prueba');
if (a.startsWith('policy assignment list')) decir('');
if (a.startsWith('functionapp list-flexconsumption-locations')) decir('eastus\\neastus2');
if (a.startsWith('provider show')) decir(a.includes('Microsoft.Web') ? 'Registered' : 'NotRegistered');
if (a.startsWith('identity show')) decir(a.includes('clientId') ? 'cliente-prueba' : 'principal-prueba');
if (a.startsWith('identity federated-credential show')) process.exit(${existe} ? 0 : 3);
if (a.startsWith('role assignment list')) decir(${existe} ? '/asignacion/existente' : '');
if (a.startsWith('deployment group what-if')) {
  const archivo = args[args.indexOf('--parameters') + 1].slice(1);
  const p = JSON.parse(fs.readFileSync(archivo, 'utf8')).parameters;
  decir(p.claveAdministracion.value.length > 20 ? 'what-if: sin cambios fuera del grupo' : 'clave invalida');
}
decir();
`);
  writeFileSync(join(directorio, 'gh'), `#!/usr/bin/env node
${comun}
if (a.startsWith('repo view')) decir('propietario/demo');
if (a.startsWith('api users/')) decir('42');
if (a.includes('deployment-branch-policies --jq')) decir(${existe} ? 'main' : '');
decir();
`);
  chmodSync(join(directorio, 'az'), 0o755);
  chmodSync(join(directorio, 'gh'), 0o755);
  return () => readFileSync(registro, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

async function preparar(directorio, entorno = {}, argumentos = []) {
  return ejecutar('bash', ['infra/scripts/preparar-azure.sh', ...argumentos], {
    cwd: raiz,
    env: { ...process.env, PATH: `${directorio}:${process.env.PATH}`, CORREO_PRESUPUESTO: 'operacion@example.org', REVISORES: 'revisora', ...entorno },
  });
}

test('RF-1205 RNF-1202: la preparacion federa solo prod, asigna roles minimos sin Owner y configura el entorno', async () => {
  const directorio = mkdtempSync(join(tmpdir(), 'sigecat-preparar-'));
  const llamadas = doblesPreparacion(directorio);
  const { stdout } = await preparar(directorio, {}, ['--what-if']);
  const az = llamadas().filter((l) => l.bin === 'az').map((l) => l.args);
  const gh = llamadas().filter((l) => l.bin === 'gh');

  const federada = az.find((a) => a.join(' ').startsWith('identity federated-credential create'));
  assert.equal(federada[federada.indexOf('--subject') + 1], 'repo:propietario/demo:environment:prod');
  assert.equal(federada[federada.indexOf('--issuer') + 1], 'https://token.actions.githubusercontent.com');
  assert.equal(federada[federada.indexOf('--audiences') + 1], 'api://AzureADTokenExchange');

  const roles = az.filter((a) => a.join(' ').startsWith('role assignment create'));
  assert.deepEqual(roles.map((a) => a[a.indexOf('--role') + 1]), ['Contributor', 'Key Vault Secrets Officer', 'Role Based Access Control Administrator']);
  for (const a of roles) assert.equal(a[a.indexOf('--scope') + 1], '/subscriptions/suscripcion-prueba/resourceGroups/rg-sigecat-prod');
  const condicion = roles[2][roles[2].indexOf('--condition') + 1];
  const rolesPlantilla = [...leer('infra/modulos/permisos.bicep').matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)].map((m) => m[0]);
  assert.equal(rolesPlantilla.length, 4);
  for (const id of rolesPlantilla) assert.equal(condicion.split(id).length, 3, `el rol ${id} debe figurar en escritura y borrado`);
  assert.ok(!JSON.stringify(az).includes('Owner'));

  assert.equal(az.filter((a) => a[0] === 'provider' && a[1] === 'register').length, 9);
  const entornoProd = gh.find((l) => l.args.includes('PUT'));
  assert.deepEqual(JSON.parse(entornoProd.entrada), { prevent_self_review: true, reviewers: [{ type: 'User', id: 42 }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } });
  const variables = Object.fromEntries(gh.filter((l) => l.args[0] === 'variable').map((l) => [l.args[2], l.args[l.args.indexOf('--body') + 1]]));
  assert.equal(variables.AZURE_CLIENT_ID, 'cliente-prueba');
  assert.equal(variables.AZURE_TENANT_ID, 'inquilino-prueba');
  assert.equal(variables.AZURE_SUBSCRIPTION_ID, 'suscripcion-prueba');
  for (const l of gh.filter((x) => x.args[0] === 'variable')) {
    assert.equal(l.args[l.args.indexOf('--env') + 1], 'prod');
    assert.equal(l.args[l.args.indexOf('--repo') + 1], 'propietario/demo');
  }

  assert.match(stdout, /what-if: sin cambios fuera del grupo/);
  assert.ok(!stdout.includes('SgC9!'), 'la clave ficticia del what-if no se imprime');
});

test('RF-1205: repetir la preparacion no duplica la credencial, los roles ni la rama autorizada', async () => {
  const directorio = mkdtempSync(join(tmpdir(), 'sigecat-preparar-'));
  const llamadas = doblesPreparacion(directorio, { existe: true });
  await preparar(directorio);
  const texto = llamadas().map((l) => l.args.join(' '));
  assert.ok(!texto.some((t) => t.startsWith('identity federated-credential create')));
  assert.ok(!texto.some((t) => t.startsWith('role assignment create')));
  assert.ok(!texto.some((t) => t.includes('--method POST')));
});

test('RF-1205: la preparacion se detiene si Functions Flex no existe en la region', async () => {
  const directorio = mkdtempSync(join(tmpdir(), 'sigecat-preparar-'));
  const llamadas = doblesPreparacion(directorio);
  const error = await preparar(directorio, { UBICACION: 'brazilsouth' }).catch((fallo) => fallo);
  assert.equal(error.code, 1);
  assert.match(error.stderr, /Flex Consumption no esta disponible en brazilsouth/);
  assert.ok(!llamadas().some((l) => l.args[0] === 'group'));
});

test('RNF-1201: la guia de despliegue tiene sus secciones y solo cita scripts que existen', () => {
  const guia = leer('docs/despliegue-azure.md');
  for (const seccion of ['Antes de empezar', 'Preparación única', 'Desplegar la API y la base de datos', 'Publicar la web', 'Verificar seguridad', 'Ensayo de caída', 'Conectar pantallas', 'Recorrido completo', 'Reversión', 'Costos']) {
    assert.match(guia, new RegExp(`^## .*${seccion}`, 'mi'), `Falta la sección ${seccion}`);
  }
  const citados = new Set([...guia.matchAll(/(?:infra\/scripts|\.github\/workflows|api\/scripts)\/[\w.-]+\.(?:sh|mjs|py|ts|yml)/g)].map((m) => m[0]));
  assert.ok(citados.size >= 6);
  for (const ruta of citados) assert.ok(existsSync(join(raiz, ruta)), `No existe ${ruta}`);
  assert.doesNotMatch(guia, /AccountKey=|Password=|sig=[A-Za-z0-9%]{20}|ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
});
