import { ErrorJustificacion, type AusenciaRef, type Justificacion } from "@/lib/justificaciones/tipos";
import type { Tx } from "../../../compartido/bd/transaccion";
import type { RepositorioJustificaciones } from "../dominio/puertos";

type Fila = {
  id: string; lote_id: string; ciclo_id: string; catequizando_id: string; sesion_id: string; tipo_sesion: Justificacion["tipoSesion"];
  fecha_sesion: string; causa: Justificacion["causa"]; anticipada: boolean; evidencia_id: string; enviada_por: string; enviada_en: Date;
  canal: Justificacion["canal"]; registrada_por: string | null; registrada_en: Date | null; estado_revision: Justificacion["estadoRevision"];
  revisada_por: string | null; revisada_en: Date | null; motivo_rechazo: string | null; sin_efecto_desde: Date | null;
};
export const COLUMNAS_JUSTIFICACION = `j.id,j.lote_id,j.ciclo_id,j.catequizando_id,j.sesion_id,j.tipo_sesion,j.fecha_sesion::text AS fecha_sesion,j.causa,j.anticipada,
  j.evidencia_id,j.enviada_por,j.enviada_en,j.canal,j.registrada_por,j.registrada_en,j.estado_revision,j.revisada_por,j.revisada_en,j.motivo_rechazo,j.sin_efecto_desde`;

export function aJustificacion(f: Fila): Justificacion {
  return {
    id: f.id, loteId: f.lote_id, cicloId: f.ciclo_id, catequizandoId: f.catequizando_id, sesionId: f.sesion_id, tipoSesion: f.tipo_sesion,
    fecha: f.fecha_sesion, causa: f.causa, anticipada: f.anticipada, evidenciaId: f.evidencia_id, enviadaPor: f.enviada_por,
    enviadaEn: f.enviada_en.toISOString(), canal: f.canal, registradaPor: f.registrada_por, registradaEn: f.registrada_en?.toISOString() ?? null,
    estadoRevision: f.estado_revision, revisadaPor: f.revisada_por, revisadaEn: f.revisada_en?.toISOString() ?? null,
    motivoRechazo: f.motivo_rechazo, sinEfectoDesde: f.sin_efecto_desde?.toISOString() ?? null,
  };
}

async function evento(tx: Tx, justificacionId: string, tipo: string, por: string | null, detalle: Record<string, unknown> = {}): Promise<void> {
  await tx.query("INSERT INTO justificacion_evento(justificacion_id,tipo,por,detalle) VALUES($1,$2,$3,$4)", [justificacionId, tipo, por, JSON.stringify(detalle)]);
}

async function listarPorLote(tx: Tx, loteId: string): Promise<Justificacion[]> {
  const filas = await tx.query<Fila>(`SELECT ${COLUMNAS_JUSTIFICACION} FROM justificacion j WHERE j.lote_id=$1 ORDER BY j.fecha_sesion,j.catequizando_id,j.sesion_id`, [loteId]);
  return filas.rows.map(aJustificacion);
}

/** El savepoint deja el lote completo o nada, aunque quien llama siga usando la transacción. */
async function insertarLote(tx: Tx, justificaciones: readonly Justificacion[], por: string | null): Promise<Justificacion[]> {
  if (!justificaciones.length) return [];
  const loteId = justificaciones[0].loteId;
  if (justificaciones.some(j => j.loteId !== loteId)) throw new ErrorJustificacion("lote_inconsistente");
  await tx.query("SAVEPOINT insertar_lote");
  try {
    for (const j of justificaciones) {
      const insertada = await tx.query(`INSERT INTO justificacion(id,lote_id,ciclo_id,catequizando_id,sesion_id,tipo_sesion,fecha_sesion,causa,anticipada,
        evidencia_id,enviada_por,enviada_en,canal,registrada_por,registrada_en)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [j.id, j.loteId, j.cicloId, j.catequizandoId, j.sesionId, j.tipoSesion, j.fecha, j.causa, j.anticipada, j.evidenciaId, j.enviadaPor, j.enviadaEn, j.canal, j.registradaPor, j.registradaEn]);
      if (insertada.rowCount) await evento(tx, j.id, "creada", por, { loteId });
    }
    const ajenas = await tx.query("SELECT 1 FROM justificacion WHERE id=ANY($1::uuid[]) AND lote_id<>$2", [justificaciones.map(j => j.id), loteId]);
    if (ajenas.rowCount) throw new ErrorJustificacion("lote_en_conflicto");
    await tx.query("RELEASE SAVEPOINT insertar_lote");
  } catch (error) {
    await tx.query("ROLLBACK TO SAVEPOINT insertar_lote");
    await tx.query("RELEASE SAVEPOINT insertar_lote");
    throw error;
  }
  return listarPorLote(tx, loteId);
}

async function obtener(tx: Tx, id: string): Promise<Justificacion | undefined> {
  const filas = await tx.query<Fila>(`SELECT ${COLUMNAS_JUSTIFICACION} FROM justificacion j WHERE j.id=$1`, [id]);
  return filas.rows[0] && aJustificacion(filas.rows[0]);
}

async function guardarRevision(tx: Tx, j: Justificacion): Promise<void> {
  if (j.estadoRevision === "pendiente" || !j.revisadaPor || !j.revisadaEn) throw new ErrorJustificacion("revision_incompleta");
  const actualizada = await tx.query(`UPDATE justificacion SET estado_revision=$2,revisada_por=$3,revisada_en=$4,motivo_rechazo=$5
    WHERE id=$1 AND estado_revision='pendiente' AND sin_efecto_desde IS NULL`, [j.id, j.estadoRevision, j.revisadaPor, j.revisadaEn, j.motivoRechazo]);
  if (!actualizada.rowCount) throw new ErrorJustificacion("no_pendiente");
  await evento(tx, j.id, j.estadoRevision, j.revisadaPor);
}

type Ausencia = Pick<AusenciaRef, "catequizandoId" | "sesionId">;

async function marcarSinEfecto(tx: Tx, a: Ausencia, en: Date): Promise<string[]> {
  const filas = await tx.query<{ id: string }>("UPDATE justificacion SET sin_efecto_desde=$3 WHERE catequizando_id=$1 AND sesion_id=$2 AND sin_efecto_desde IS NULL RETURNING id", [a.catequizandoId, a.sesionId, en]);
  for (const { id } of filas.rows) await evento(tx, id, "sin_efecto", null);
  return filas.rows.map(f => f.id);
}

async function restaurarEfecto(tx: Tx, a: Ausencia): Promise<string[]> {
  const filas = await tx.query<{ id: string }>("UPDATE justificacion SET sin_efecto_desde=NULL WHERE catequizando_id=$1 AND sesion_id=$2 AND sin_efecto_desde IS NOT NULL RETURNING id", [a.catequizandoId, a.sesionId]);
  for (const { id } of filas.rows) await evento(tx, id, "efecto_restaurado", null);
  return filas.rows.map(f => f.id);
}

export const repositorioJustificacionesPg: RepositorioJustificaciones = { insertarLote, obtener, guardarRevision, marcarSinEfecto, restaurarEfecto };
