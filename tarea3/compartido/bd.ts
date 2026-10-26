// Pool de pg y helper transaccional compartido (spec 009, plan §5, RF-902).
// Usado por servicio-consulta (P2) y servicio-actualizacion (P3).

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PUERTO_POSTGRES ?? process.env.PGPORT ?? 55432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? 'postgres',
  database: process.env.PGDATABASE ?? 'sigecat',
});

export { pool };

// Ejecuta una función dentro de una transacción; hace commit o rollback.
export async function transaccionar<T>(trabajo: (cliente: any) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {
      // ignore rollback errors
    });
    throw error;
  } finally {
    cliente.release();
  }
}

export async function cerrarPool(): Promise<void> {
  await pool.end();
}
