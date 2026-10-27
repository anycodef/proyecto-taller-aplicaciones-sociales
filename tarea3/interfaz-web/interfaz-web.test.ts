import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ruta = (archivo: string) => new URL(archivo, import.meta.url);

test('RF-902: la interfaz visual ejecuta consultas selectivas contra GraphQL', async () => {
  const [html, javascript] = await Promise.all([
    readFile(ruta('index.html'), 'utf8'),
    readFile(ruta('app.js'), 'utf8'),
  ]);
  assert.match(html, /Campos solicitados/);
  assert.match(javascript, /query ListaCatequizandos/);
  assert.match(javascript, /catequizandos\(grupoId:/);
  assert.match(javascript, /fetch\('\/api\/graphql'/);
  assert.doesNotMatch(javascript, /salud|neurodivergencia|documento/i);
});

test('RF-904: la interfaz demuestra mutación GraphQL y consulta posterior', async () => {
  const javascript = await readFile(ruta('app.js'), 'utf8');
  assert.match(javascript, /mutation Registrar/);
  assert.match(javascript, /registrarAsistencia/);
  assert.match(javascript, /query Confirmar/);
  assert.match(javascript, /consulta posterior no encontró el UUID registrado/);
});

test('RF-906: la demo web mantiene el JWT en el servidor y no lo entrega al navegador', async () => {
  const [servidor, javascript] = await Promise.all([
    readFile(new URL('../scripts/demo-web.mjs', import.meta.url), 'utf8'),
    readFile(ruta('app.js'), 'utf8'),
  ]);
  assert.match(servidor, /authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(javascript, /SIGECAT_TOKEN|Authorization|Bearer/);
});
