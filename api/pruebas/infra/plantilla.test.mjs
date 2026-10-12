import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const temporal = mkdtempSync(join(tmpdir(), 'sigecat-bicep-'));
let plantilla;
try {
  const archivo = join(temporal, 'plantilla.json');
  const argumentos = ['build', join(raiz, 'infra/main.bicep'), '--outfile', archivo];
  if (process.env.BICEP_BIN) {
    execFileSync(process.env.BICEP_BIN, argumentos, { stdio: 'pipe' });
  } else {
    execFileSync('az', ['bicep', 'build', '--file', argumentos[1], '--outfile', archivo], { stdio: 'pipe' });
  }
  plantilla = JSON.parse(readFileSync(archivo, 'utf8'));
} catch (error) {
  throw new Error(`Bicep no compila o falta CLI. Instalar az bicep o definir BICEP_BIN. ${error.message}`);
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
function recursosDe(tipo) {
  const encontrados = [];
  function recorrer(valor) {
    if (!valor || typeof valor !== 'object') return;
    if (valor.type === tipo) encontrados.push(valor);
    for (const hijo of Object.values(valor)) recorrer(hijo);
  }
  recorrer(plantilla);
  assert.ok(encontrados.length, `Falta recurso compilado ${tipo}`);
  return encontrados;
}
const leerPolitica = (nombre) => readFileSync(join(raiz, 'infra/politicas', nombre), 'utf8');

test('RF-101: la plantilla exige JWT HS256 salvo POST acceso y protege Functions con clave de host', () => {
  const politica = leerPolitica('api.xml');
  assert.match(politica, /!\(context.Request.Method == &quot;POST&quot; &amp;&amp; context.Request.Url.Path.StartsWith\(&quot;\/v1\/acceso\//);
  assert.match(politica, /require-expiration-time="true"/);
  assert.match(politica, /<issuer>sigecat<\/issuer>/);
  assert.match(politica, /<audience>sigecat-api<\/audience>/);
  assert.match(politica, /Algorithm != &quot;HS256&quot;/);
  assert.match(politica, /\{"codigo":"acceso_denegado"\}/);
  assert.match(leerPolitica('global.xml'), /name="x-functions-key" exists-action="override"/);
  const valores = recursosDe('Microsoft.ApiManagement/service/namedValues');
  assert.equal(valores[0].properties.secret, true);
  assert.ok(valores[0].properties.keyVault.secretIdentifier);
  const api = recursosDe('Microsoft.ApiManagement/service/apis')[0];
  assert.equal(api.properties.subscriptionRequired, true);
});

test('RNF-103: HTTPS y TLS obligatorios en Functions, PostgreSQL y almacenamiento privado', () => {
  const funciones = recursosDe('Microsoft.Web/sites')[0];
  assert.equal(funciones.properties.httpsOnly, true);
  assert.equal(funciones.properties.siteConfig.minTlsVersion, '1.2');
  assert.equal(funciones.properties.siteConfig.scmMinTlsVersion, '1.2');
  const almacen = recursosDe('Microsoft.Storage/storageAccounts')[0];
  assert.equal(almacen.sku.name, 'Standard_LRS');
  assert.equal(almacen.properties.supportsHttpsTrafficOnly, true);
  assert.equal(almacen.properties.minimumTlsVersion, 'TLS1_2');
  assert.equal(almacen.properties.allowBlobPublicAccess, false);
  for (const contenedor of recursosDe('Microsoft.Storage/storageAccounts/blobServices/containers')) {
    assert.equal(contenedor.properties.publicAccess, 'None');
  }
  const postgres = recursosDe('Microsoft.DBforPostgreSQL/flexibleServers')[0];
  assert.equal(postgres.properties.version, '16');
  assert.equal(postgres.sku.name, 'Standard_B1ms');
  assert.equal(recursosDe('Microsoft.DBforPostgreSQL/flexibleServers/configurations')[0].properties.value, 'ON');
  assert.deepEqual(recursosDe('Microsoft.ApiManagement/service/apis')[0].properties.protocols, ['https']);
  assert.equal(plantilla.parameters.claveAdministracion.type.toLowerCase(), 'securestring');
});

test('RNF-303: Flex Node22 acota cada grupo a cinco instancias HTTP10 memoria2048 y cero always-ready', () => {
  const funciones = recursosDe('Microsoft.Web/sites')[0];
  assert.equal(funciones.kind, 'functionapp,linux');
  assert.deepEqual(funciones.properties.functionAppConfig.runtime, { name: 'node', version: '22' });
  assert.deepEqual(funciones.properties.functionAppConfig.scaleAndConcurrency, {
    maximumInstanceCount: 5, instanceMemoryMB: 2048, alwaysReady: [], triggers: { http: { perInstanceConcurrency: 10 } },
  });
  assert.equal(funciones.properties.functionAppConfig.deployment.storage.authentication.type, 'SystemAssignedIdentity');
  const ajustes = Object.fromEntries(funciones.properties.siteConfig.appSettings.map(({ name, value }) => [name, value]));
  assert.equal(ajustes.PG_POOL_MAX, '3');
  for (const obsoleto of ['FUNCTIONS_WORKER_PROCESS_COUNT', 'FUNCTIONS_EXTENSION_VERSION', 'TZ', 'WEBSITE_TIME_ZONE', 'WEBSITE_RUN_FROM_PACKAGE']) {
    assert.equal(ajustes[obsoleto], undefined, `${obsoleto} no es valido para Flex`);
  }
  for (const secreto of ['BD_URL', 'JWT_CLAVE', 'JWT_KID', 'RENOVACION_CLAVE', 'URL_WEB', 'BLOBS_CONEXION']) {
    assert.match(ajustes[secreto], /@Microsoft.KeyVault/);
  }
  assert.match(leerPolitica('api.xml'), /max-size="524288"/);
  assert.doesNotMatch(leerPolitica('api.xml'), /rate-limit-by-key/);
});

test('RNF-101 RNF-203: no-store, CORS fijo y diagnosticos sin cuerpos ni cabeceras', () => {
  const politica = leerPolitica('api.xml');
  for (const ruta of ['/perfil', '/condiciones', '/documentos', '/identidad-real']) {
    assert.ok(politica.includes(ruta));
  }
  assert.match(politica, /<value>no-store<\/value>/);
  assert.doesNotMatch(leerPolitica('global.xml'), /localhost|<origin>\*<\/origin>/);
  const diagnostico = recursosDe('Microsoft.ApiManagement/service/diagnostics')[0].properties;
  assert.equal(diagnostico.logClientIp, false);
  for (const lado of ['frontend', 'backend']) {
    for (const mensaje of ['request', 'response']) {
      assert.equal(diagnostico[lado][mensaje].body.bytes, 0);
      assert.deepEqual(diagnostico[lado][mensaje].headers, []);
    }
  }
});

test('RNF-104: presupuesto mensual cinco y cuota diaria de ingesta declarados', () => {
  const presupuesto = recursosDe('Microsoft.Consumption/budgets')[0].properties;
  assert.equal(presupuesto.amount, 5);
  assert.equal(presupuesto.timeGrain, 'Monthly');
  assert.equal(presupuesto.notifications.aviso.threshold, 80);
  assert.ok(plantilla.parameters.correoPresupuesto);
  const cuota = recursosDe('Microsoft.OperationalInsights/workspaces')[0].properties.workspaceCapping.dailyQuotaGb;
  assert.equal(cuota, "[json('0.1')]");
});

test('RF-101: la rotacion expone clave anterior opcional sin secretos en la plantilla', () => {
  assert.equal(plantilla.parameters.jwtKidAnterior.defaultValue, '');
  const politicas = recursosDe('Microsoft.ApiManagement/service/apis/policies');
  assert.match(politicas[0].properties.value, /jwtKidAnterior/);
  assert.match(politicas[0].properties.value, /jwt-clave-anterior-apim/);
  const ajustes = recursosDe('Microsoft.Web/sites')[0].properties.siteConfig.appSettings;
  assert.match(ajustes.find((ajuste) => ajuste.name === 'JWT_CLAVES').value, /secrets\/jwt-claves/);
});
