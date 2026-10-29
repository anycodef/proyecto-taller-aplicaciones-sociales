import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { sembrar } from '../scripts/bd-sembrar.mjs';

const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  port: Number(process.env.PUERTO_POSTGRES ?? process.env.PGPORT ?? 55432),
  user: 'postgres',
  database: 'sigecat',
});

test('RNF-901: la siembra es 100 % ficticia: 2 grupos, 12 catequizandos con identidadOperativa y 6 domingos', async () => {
  await sembrar();

  const grupos = await pool.query('SELECT count(*) FROM demo_tarea3.grupo');
  assert.strictEqual(Number(grupos.rows[0].count), 2);

  const niños = await pool.query('SELECT count(*) FROM demo_tarea3.catequizando');
  assert.strictEqual(Number(niños.rows[0].count), 12);

  const sinIdentidad = await pool.query(
    "SELECT count(*) FROM demo_tarea3.catequizando WHERE identidad_operativa = '' OR identidad_operativa IS NULL"
  );
  assert.strictEqual(Number(sinIdentidad.rows[0].count), 0);

  const asistencias = await pool.query('SELECT count(*) FROM demo_tarea3.asistencia');
  assert.strictEqual(Number(asistencias.rows[0].count), 12 * 6);
});

test.after(async () => {
  await pool.end();
});
