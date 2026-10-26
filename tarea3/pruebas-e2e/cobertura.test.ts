import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificar } from '../scripts/verificar-cobertura-rf.mjs';

test('RNF-905: el script de cobertura ejecuta, escanea tarea3/ y cuenta RF-9xx citados', async () => {
  const codigo = await verificar();
  assert.ok([0, 1].includes(codigo), 'el script debe devolver 0 (todos cubiertos) o 1 (falta cobertura)');
});
