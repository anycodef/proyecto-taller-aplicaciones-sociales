import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Pool } = pg;

const RUTA_MIGRACION = join(import.meta.dirname, '..', 'bd', 'migracion.sql');

function crearPool() {
  return new Pool({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PUERTO_POSTGRES ?? process.env.PGPORT ?? 55432),
    user: process.env.PGUSER ?? 'postgres',
    database: process.env.PGDATABASE ?? 'sigecat',
  });
}

export async function subir() {
  const pool = crearPool();
  try {
    const sql = await readFile(RUTA_MIGRACION, 'utf8');
    await pool.query(sql);
    // eslint-disable-next-line no-console
    console.log('[bd:subir] esquema demo_tarea3 creado en PostgreSQL');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('bd-subir.mjs')) {
  subir().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[bd:subir] error:', error.message);
    process.exit(1);
  });
}
