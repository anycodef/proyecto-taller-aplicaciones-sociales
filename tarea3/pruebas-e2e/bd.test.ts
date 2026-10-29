import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { subir } from '../scripts/bd-subir.mjs';

const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  port: Number(process.env.PUERTO_POSTGRES ?? process.env.PGPORT ?? 55432),
  user: 'postgres',
  database: 'sigecat',
});

test('RF-912: la migración crea y borra el esquema demo_tarea3 repetidamente sin error', async () => {
  await subir();
  await subir(); // segunda ejecución: DROP + CREATE debe seguir funcionando

  const tablas = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'demo_tarea3'
    ORDER BY table_name;
  `);
  const nombres = tablas.rows.map((fila) => fila.table_name);
  assert.deepStrictEqual(nombres.sort(), [
    'asistencia',
    'catequizando',
    'grupo',
    'justificacion',
    'riesgo',
  ]);
});

test.after(async () => {
  await pool.end();
});
