import type { PoolClient } from "pg";
import { obtenerPool } from "./pool";

export type Tx = Pick<PoolClient, "query">;
export async function enTransaccion<T>(operacion: (tx: Tx) => Promise<T>): Promise<T> {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await operacion(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}
