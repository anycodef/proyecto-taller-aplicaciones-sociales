import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
export async function cicloAbierto(tx: Tx): Promise<string | null> {
  return (await tx.query<{ id: string }>("SELECT id FROM ciclo WHERE estado='abierto' FOR SHARE")).rows[0]?.id ?? null;
}
export async function asegurarCicloAbierto(tx: Tx, cicloId: string): Promise<void> {
  const ciclo = await tx.query("SELECT id FROM ciclo WHERE id=$1 AND estado='abierto' FOR SHARE", [cicloId]);
  if (!ciclo.rowCount) throw new ErrorAplicacion(409, "ciclo_no_abierto");
}
