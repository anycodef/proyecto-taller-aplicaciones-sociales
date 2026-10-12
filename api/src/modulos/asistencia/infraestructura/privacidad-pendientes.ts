import type { Tx } from "../../../compartido/bd/transaccion";

const patronUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
export function referenciasDePendiente(fila: { catequizando_id: string | null; codigo_leido?: string | null }): string[] {
  return [...new Set([...(fila.catequizando_id ? [fila.catequizando_id.toLowerCase()] : []), ...(fila.codigo_leido?.match(patronUuid) ?? []).map(id => id.toLowerCase())])];
}
export async function bloquearNinosDelPush(cicloIds: string[], referencias: string[], tx: Tx): Promise<Map<string, string>> {
  // FuenteInscripciones también bloquea la nómina: adquirirla completa primero evita invertir el orden entre niños.
  const resultado = await tx.query<{ id: string; estado: string }>(`SELECT n.id,n.estado FROM catequizando n
    WHERE n.id=ANY($1::uuid[]) OR EXISTS(SELECT 1 FROM inscripcion i WHERE i.catequizando_id=n.id AND i.ciclo_id=ANY($2::uuid[]))
    ORDER BY n.id FOR SHARE OF n`, [referencias, cicloIds]);
  return new Map(resultado.rows.map(fila => [fila.id, fila.estado]));
}
export function sinVinculoPersonal<T extends Record<string, unknown>>(fila: T): Record<string, unknown> {
  const minimizada: Record<string, unknown> = { ...fila, catequizando_id: null };
  if ("codigo_leido" in fila) minimizada.codigo_leido = null;
  if ("motivo" in fila) minimizada.motivo = null;
  return minimizada;
}
