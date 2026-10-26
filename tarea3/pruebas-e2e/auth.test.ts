import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitirToken, verificarToken, puedeLeerGrupo, puedeEscribir } from '../compartido/auth.ts';

const GRUPO_A = '11111111-1111-1111-1111-111111111101';
const GRUPO_B = '11111111-1111-1111-1111-111111111102';

test('RF-906: emitirToken y verificarToken devuelven el payload con rol y grupo', async () => {
  const token = await emitirToken({
    rol: 'CAT',
    grupoId: GRUPO_A,
    identidadOperativa: 'Catequista Demo',
    sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  });
  const payload = await verificarToken(token);
  assert.strictEqual(payload.rol, 'CAT');
  assert.strictEqual(payload.grupoId, GRUPO_A);
  assert.strictEqual(payload.identidadOperativa, 'Catequista Demo');
});

test('RF-906: CAT solo lee su propio grupo', () => {
  assert.ok(puedeLeerGrupo('CAT', GRUPO_A, GRUPO_A));
  assert.ok(!puedeLeerGrupo('CAT', GRUPO_A, GRUPO_B));
});

test('RF-906: COORD lee cualquier grupo', () => {
  assert.ok(puedeLeerGrupo('COORD', undefined, GRUPO_A));
  assert.ok(puedeLeerGrupo('COORD', undefined, GRUPO_B));
});

test('RF-906: SUP lee todo', () => {
  assert.ok(puedeLeerGrupo('SUP', undefined, GRUPO_A));
});

test('RF-906: FAM no lee por grupo (solo a su hijo)', () => {
  assert.ok(!puedeLeerGrupo('FAM', GRUPO_A, GRUPO_A));
});

test('RF-906: SUP nunca escribe; los demás sí', () => {
  assert.ok(puedeEscribir('COORD'));
  assert.ok(puedeEscribir('CAT'));
  assert.ok(puedeEscribir('FAM'));
  assert.ok(!puedeEscribir('SUP'));
});
