import type { z } from "zod";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearNino, cicloAbierto } from "../infraestructura/comun";
import { auditarAcceso } from "../infraestructura/auditoria";
import type * as esquemas from "../http/esquemas";
export async function consultarCondiciones(tx: Tx, id: string, contexto: ContextoAcceso) {
  // La lectura no se entrega si falla su auditoría; ambos pasos comparten transacción.
  await auditarAcceso(tx, contexto, "restringido:leer", id);
  return (await tx.query("SELECT id,categoria,nota FROM condicion_catequizando WHERE catequizando_id=$1 ORDER BY categoria", [id])).rows;
}
export async function registrarCondiciones(tx: Tx, id: string, datos: z.infer<typeof esquemas.condiciones>, contexto: ContextoAcceso) {
  await bloquearNino(tx, id);
  await cicloAbierto(tx);
  for (const c of datos.condiciones) {
    const existe = await tx.query("SELECT id FROM condicion_catequizando WHERE id=$1 AND (catequizando_id<>$2 OR categoria<>$3)", [c.id, id, c.categoria]);
    if (existe.rowCount) throw new ErrorAplicacion(409, "uuid_en_conflicto");
  }
  await tx.query("DELETE FROM condicion_catequizando WHERE catequizando_id=$1 AND NOT(id=ANY($2::uuid[]))", [id, datos.condiciones.map(c => c.id)]);
  for (const c of datos.condiciones) await tx.query("INSERT INTO condicion_catequizando(id,catequizando_id,categoria,nota,registrado_por) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET nota=EXCLUDED.nota,registrado_por=EXCLUDED.registrado_por,registrado_en=clock_timestamp()", [c.id, id, c.categoria, c.nota ?? null, contexto.cuentaId]);
  await auditarAcceso(tx, contexto, "restringido:escribir", id);
  return { catequizandoId: id };
}
