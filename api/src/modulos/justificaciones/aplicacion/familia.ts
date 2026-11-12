import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { hoyEnLima } from "@/lib/seguridad/fechas";
import { estadoVisible } from "@/lib/justificaciones/estados";
import { ausenciasJustificables, sesionesAnticipables, type SesionFutura } from "@/lib/justificaciones/justificables";
import { fechaLimite } from "@/lib/justificaciones/plazo";
import type { AusenciaRef, Justificacion } from "@/lib/justificaciones/tipos";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { consultarAusencias } from "../../asistencia/aplicacion/consultar-faltas";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { repositorioJustificacionesPg as repo } from "../infraestructura/repositorio-justificaciones-pg";

export type ContextoFamilia = { cicloId: string; apoderadoId: string; hijos: string[] };

/** El apoderado se deduce de la cuenta; los hijos, del contexto de 001 (vínculos vigentes). */
export async function contextoFamilia(ctx: ContextoAcceso, tx: Tx): Promise<ContextoFamilia> {
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  const apoderado = await tx.query<{ id: string }>("SELECT id FROM apoderado WHERE cuenta_id=$1", [ctx.cuentaId]);
  if (!apoderado.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  return { cicloId, apoderadoId: apoderado.rows[0].id, hijos: [...ctx.catequizandosApoderados].sort() };
}

export async function ausenciasDeHijos(cicloId: string, hijos: readonly string[], ahora: Date, tx: Tx): Promise<AusenciaRef[]> {
  const ausencias: AusenciaRef[] = [];
  for (const catequizandoId of hijos) {
    for (const fila of await consultarAusencias(cicloId, { catequizandoId, ahora: ahora.getTime() }, tx)) {
      ausencias.push({ catequizandoId, sesionId: fila.sesion.id, tipoSesion: fila.sesion.tipo, fecha: fila.sesion.fecha });
    }
  }
  return ausencias;
}

export async function justificacionesDeHijos(hijos: readonly string[], tx: Tx): Promise<Justificacion[]> {
  const todas: Justificacion[] = [];
  for (const catequizandoId of hijos) todas.push(...await repo.listarPorCatequizando(tx, catequizandoId));
  return todas;
}

export async function sesionesFuturas(cicloId: string, ahora: Date, tx: Tx): Promise<SesionFutura[]> {
  const filas = await tx.query<{ id: string; ciclo_id: string; fecha: string; tipo: SesionFutura["tipo"]; cancelada: boolean }>(
    `SELECT s.id,s.ciclo_id,s.fecha::text AS fecha,s.tipo,s.cancelada OR COALESCE(a.estado='cancelada',false) AS cancelada
      FROM sesion s LEFT JOIN actividad_obligatoria a ON a.id=s.actividad_id
      WHERE s.ciclo_id=$1 AND s.eliminado_en IS NULL AND s.fecha>$2::date ORDER BY s.fecha,s.tipo,s.id`, [cicloId, hoyEnLima(ahora)]);
  return filas.rows.map(f => ({ id: f.id, cicloId: f.ciclo_id, fecha: f.fecha, tipo: f.tipo, cancelada: f.cancelada }));
}

async function nombresDe(hijos: readonly string[], tx: Tx): Promise<{ catequizandoId: string; nombres: string }[]> {
  const filas = await tx.query<{ id: string; nombres: string }>("SELECT id,nombres FROM catequizando WHERE id=ANY($1::uuid[]) ORDER BY nombres,id", [[...hijos]]);
  return filas.rows.map(f => ({ catequizandoId: f.id, nombres: f.nombres }));
}

export type AusenciaJustificable = AusenciaRef & { venceEn: string };

export async function listarJustificables(ctx: ContextoAcceso, ahora: Date, tx: Tx): Promise<{ cicloId: string; diasPlazo: number; ninos: { catequizandoId: string; nombres: string }[]; ausencias: AusenciaJustificable[] }> {
  const familia = await contextoFamilia(ctx, tx);
  const { diasPlazo } = await repo.obtenerPlazo(tx, familia.cicloId);
  const justificables = ausenciasJustificables(await ausenciasDeHijos(familia.cicloId, familia.hijos, ahora, tx), await justificacionesDeHijos(familia.hijos, tx), diasPlazo, ahora);
  return {
    cicloId: familia.cicloId,
    diasPlazo,
    ninos: await nombresDe(familia.hijos, tx),
    ausencias: justificables.map(a => ({ ...a, venceEn: fechaLimite(a.fecha, diasPlazo) })),
  };
}

export async function listarAnticipables(ctx: ContextoAcceso, ahora: Date, tx: Tx): Promise<{ cicloId: string; sesiones: AusenciaRef[] }> {
  const familia = await contextoFamilia(ctx, tx);
  const sesiones = sesionesAnticipables({
    sesiones: await sesionesFuturas(familia.cicloId, ahora, tx),
    catequizandoIds: familia.hijos,
    justificaciones: await justificacionesDeHijos(familia.hijos, tx),
    cicloId: familia.cicloId,
    ahora,
  });
  return { cicloId: familia.cicloId, sesiones };
}

export type OrigenJustificacion = "usted" | "otro_apoderado" | "coordinacion";
export type JustificacionFamilia = AusenciaRef & {
  id: string; estado: ReturnType<typeof estadoVisible>; motivoRechazo: string | null; enviadaEn: string; origen: OrigenJustificacion; causa: Justificacion["causa"] | null;
};

/**
 * Lo que envió el otro apoderado se muestra con estado y motivo, sin quién ni causa (supuesto A-14).
 * Nunca se devuelve evidencia ni URL (RF-410).
 */
export async function listarMisJustificaciones(ctx: ContextoAcceso, tx: Tx): Promise<JustificacionFamilia[]> {
  const apoderado = await tx.query<{ id: string }>("SELECT id FROM apoderado WHERE cuenta_id=$1", [ctx.cuentaId]);
  const apoderadoId = apoderado.rows[0]?.id;
  if (!apoderadoId) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const hijos = new Set(ctx.catequizandosApoderados);
  return (await repo.listarPorApoderado(tx, apoderadoId)).filter(j => hijos.has(j.catequizandoId)).map(j => {
    const propia = j.enviadaPor === apoderadoId;
    const origen: OrigenJustificacion = !propia ? "otro_apoderado" : j.canal === "coordinacion" ? "coordinacion" : "usted";
    return {
      id: j.id, catequizandoId: j.catequizandoId, sesionId: j.sesionId, tipoSesion: j.tipoSesion, fecha: j.fecha,
      estado: estadoVisible(j), motivoRechazo: estadoVisible(j) === "rechazada" ? j.motivoRechazo : null, enviadaEn: j.enviadaEn, origen, causa: propia ? j.causa : null,
    };
  });
}
