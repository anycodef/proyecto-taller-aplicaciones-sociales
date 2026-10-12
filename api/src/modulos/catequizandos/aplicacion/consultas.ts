import { interpretarCodigoCarne } from "@/lib/catequizandos/carne";
import { consultar } from "../../../compartido/bd/pool";
import type { Tx } from "../../../compartido/bd/transaccion";
import type { FuenteInscripciones, PeriodoInscripcion } from "../dominio/puertos";
export async function gruposACargo(cuentaId: string, cicloId?: string): Promise<string[]> {
  const r = await consultar<{ id: string }>("SELECT g.id FROM grupo g JOIN grupo_catequista gc ON gc.grupo_id=g.id JOIN ciclo c ON c.id=g.ciclo_id WHERE gc.cuenta_id=$1 AND gc.desde<=clock_timestamp() AND gc.hasta IS NULL AND g.estado='abierto' AND c.estado='abierto' AND ($2::uuid IS NULL OR g.ciclo_id=$2) ORDER BY g.id", [cuentaId, cicloId ?? null]);
  return r.rows.map(g => g.id);
}
export async function alcanceFamilia(cuentaId: string): Promise<string[]> {
  const r = await consultar<{ id: string }>("SELECT DISTINCT n.id FROM catequizando n JOIN vinculo_apoderado v ON v.catequizando_id=n.id JOIN apoderado a ON a.id=v.apoderado_id JOIN inscripcion i ON i.catequizando_id=n.id JOIN ciclo c ON c.id=i.ciclo_id WHERE a.cuenta_id=$1 AND v.vigente_hasta IS NULL AND n.estado='vigente' AND i.estado='vigente' AND c.estado='abierto' ORDER BY n.id", [cuentaId]);
  return r.rows.map(n => n.id);
}
export async function resolverCarne(codigo: string): Promise<{ catequizandoId: string; grupoId: string | null; activo: boolean; emisionVigente: boolean } | null> {
  const codigoInterpretado = interpretarCodigoCarne(codigo);
  if ("invalido" in codigoInterpretado) return null;
  const r = await consultar<{ id: string; grupo_id: string | null; activo: boolean; emision_vigente: boolean }>("SELECT n.id,v.grupo_id,(v.catequizando_id IS NOT NULL) AS activo,EXISTS(SELECT 1 FROM carne_emision e WHERE e.catequizando_id=n.id AND e.emision=$2 AND e.invalidada_en IS NULL) AS emision_vigente FROM catequizando n LEFT JOIN v_nomina_ciclo v ON v.catequizando_id=n.id WHERE n.id=$1", [codigoInterpretado.catequizandoId, codigoInterpretado.emision]);
  const n = r.rows[0];
  return n ? { catequizandoId: n.id, grupoId: n.grupo_id, activo: n.activo, emisionVigente: n.emision_vigente } : null;
}
export async function ninosActivos(cicloId: string, fecha: string): Promise<{ catequizandoId: string; grupoId: string; inscripcionId: string }[]> {
  const r = await consultar<{ catequizandoId: string; grupoId: string; inscripcionId: string }>(`SELECT n.id AS "catequizandoId",a.grupo_id AS "grupoId",i.id AS "inscripcionId" FROM inscripcion i JOIN catequizando n ON n.id=i.catequizando_id JOIN asignacion_grupo a ON a.inscripcion_id=i.id
    WHERE i.ciclo_id=$1 AND n.estado<>'anonimizado' AND (i.desde AT TIME ZONE 'America/Lima')::date <= $2::date
    AND (i.hasta IS NULL OR (i.hasta AT TIME ZONE 'America/Lima')::date > $2::date)
    AND (a.desde AT TIME ZONE 'America/Lima')::date <= $2::date AND (a.hasta IS NULL OR (a.hasta AT TIME ZONE 'America/Lima')::date > $2::date)`, [cicloId, fecha]);
  return r.rows;
}
export const fuenteInscripciones: FuenteInscripciones = {
  async periodos(cicloId, catequizandoIds, tx) {
    const r = await tx.query<PeriodoInscripcion>(`SELECT i.id AS "inscripcionId",i.catequizando_id AS "catequizandoId",i.ciclo_id AS "cicloId",i.estado,i.desde,i.hasta,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('grupoId',a.grupo_id,'desde',a.desde,'hasta',a.hasta) ORDER BY a.desde,a.id) FROM asignacion_grupo a WHERE a.inscripcion_id=i.id),'[]'::jsonb) AS asignaciones
      FROM inscripcion i WHERE i.ciclo_id=$1 AND i.catequizando_id=ANY($2::uuid[]) ORDER BY i.desde,i.id`, [cicloId, catequizandoIds]);
    return r.rows.map(i => ({ ...i, desde: new Date(i.desde).toISOString(), hasta: i.hasta ? new Date(i.hasta).toISOString() : null }));
  }
};
export async function grupoActual(tx: Tx, catequizandoId: string) {
  return (await tx.query<{ grupoId: string; cicloId: string }>('SELECT grupo_id AS "grupoId",ciclo_id AS "cicloId" FROM v_nomina_ciclo WHERE catequizando_id=$1', [catequizandoId])).rows[0] ?? null;
}
export async function apoderadosVinculados(tx: Tx, catequizandoId: string) {
  return (await tx.query<{ apoderadoId: string; cuentaId: string; relacion: string }>('SELECT a.id AS "apoderadoId",a.cuenta_id AS "cuentaId",v.relacion FROM apoderado a JOIN vinculo_apoderado v ON v.apoderado_id=a.id WHERE v.catequizando_id=$1 AND v.vigente_hasta IS NULL', [catequizandoId])).rows;
}
