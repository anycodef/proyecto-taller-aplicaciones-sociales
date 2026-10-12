import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { configuracionBaseDatos } from "../config";

let pool: Pool | undefined;
export function obtenerPool(): Pool {
  if (!pool) {
    const connectionString = configuracionBaseDatos().url;
    pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, options: "-c timezone=America/Lima -c statement_timeout=15000" });
  }
  return pool;
}
export async function consultar<T extends QueryResultRow = QueryResultRow>(texto: string, valores: unknown[] = []): Promise<QueryResult<T>> {
  return obtenerPool().query<T>(texto, valores);
}
export async function cerrarPool(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
