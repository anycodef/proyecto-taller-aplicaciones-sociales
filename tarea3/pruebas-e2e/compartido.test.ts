import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool, transaccionar, cerrarPool } from '../compartido/bd.ts';
import type { Catequizando, NivelRiesgo } from '../compartido/tipos.ts';

test('RF-902: compartido/bd.ts expone pool pg y transacción funcional', async () => {
  // El pool conecta y responde una consulta simple.
  const resultado = await pool.query('SELECT 1 AS uno');
  assert.strictEqual(resultado.rows[0].uno, 1);

  // transaccionar abre, hace commit y cierra el cliente.
  const valor = await transaccionar(async (cliente) => {
    const r = await cliente.query('SELECT 2 AS dos');
    return r.rows[0].dos;
  });
  assert.strictEqual(valor, 2);

  // Los tipos importados son válidos (typecheck los valida).
  const catequizando: Catequizando = {} as any;
  const nivel: NivelRiesgo = 'ALTO';
  assert.ok(catequizando);
  assert.strictEqual(nivel, 'ALTO');
});

test.after(async () => {
  await cerrarPool();
});
