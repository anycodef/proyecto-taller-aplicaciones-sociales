import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { auditar } from "../../seguridad/aplicacion/auditar";
export async function auditarAcceso(tx: Tx, contexto: ContextoAcceso, accion: string, catequizandoId: string): Promise<void> {
  await auditar(contexto, { accion, recursoTipo: "catequizando", recursoId: catequizandoId, catequizandoId, resultado: "permitido" }, tx);
}
