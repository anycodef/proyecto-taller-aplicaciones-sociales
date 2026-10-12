import { codificarCarne } from "@/lib/catequizandos/carne";
import type { Carne } from "@/lib/catequizandos/contratos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearNino, cicloAbierto } from "../infraestructura/comun";
export async function consultarCarnes(tx: Tx, filtro: { catequizandoId?: string; grupoId?: string }): Promise<Carne[]> {
  const r = await tx.query<Omit<Carne, "codigoCarne">>('SELECT n.catequizando_id AS "catequizandoId",n.nombres,n.apellidos,n.grupo_id AS "grupoId",g.nombre AS grupo,n.emision FROM v_nomina_ciclo n JOIN grupo g ON g.id=n.grupo_id WHERE n.emision IS NOT NULL AND ($1::uuid IS NULL OR n.catequizando_id=$1) AND ($2::uuid IS NULL OR n.grupo_id=$2) ORDER BY n.apellidos,n.nombres,n.catequizando_id', [filtro.catequizandoId ?? null, filtro.grupoId ?? null]);
  return r.rows.map(n => ({ ...n, codigoCarne: codificarCarne(n.catequizandoId, n.emision) }));
}
export async function reemitirCarne(tx: Tx, id: string, emisionEsperada: number, contexto: ContextoAcceso) {
  await bloquearNino(tx, id);
  await cicloAbierto(tx);
  const nomina = await consultarCarnes(tx, { catequizandoId: id });
  if (!nomina[0]) throw new ErrorAplicacion(409, "catequizando_inactivo");
  if (nomina[0].emision === emisionEsperada + 1) return nomina[0];
  if (nomina[0].emision !== emisionEsperada) throw new ErrorAplicacion(409, "emision_en_conflicto");
  await tx.query("UPDATE carne_emision SET invalidada_en=clock_timestamp() WHERE catequizando_id=$1 AND invalidada_en IS NULL", [id]);
  await tx.query("INSERT INTO carne_emision(catequizando_id,emision,emitida_por) VALUES($1,$2,$3)", [id, emisionEsperada + 1, contexto.cuentaId]);
  return { ...nomina[0], emision: emisionEsperada + 1, codigoCarne: codificarCarne(id, emisionEsperada + 1) };
}
