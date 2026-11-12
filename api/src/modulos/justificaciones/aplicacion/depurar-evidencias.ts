import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import type { BorradorBlobs, RefBlob } from "../../seguridad/aplicacion/motor-retencion";
import { CONTENEDOR_EVIDENCIAS, type AlmacenEvidencias } from "../dominio/puertos";
import { obtenerAlmacenEvidencias } from "../infraestructura/almacen";

async function exigirContextoRetencion(tx: Tx): Promise<void> {
  const permiso = await tx.query<{ autorizado: boolean }>("SELECT current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retiro_consentimiento','retencion') AS autorizado");
  if (!permiso.rows[0]?.autorizado) throw new ErrorAplicacion(403, "fuera_de_alcance");
}

async function blobsDe(tx: Tx, evidenciaIds: readonly string[]): Promise<RefBlob[]> {
  if (!evidenciaIds.length) return [];
  const filas = await tx.query<{ blob_nombre: string }>("SELECT blob_nombre FROM evidencia_archivo WHERE evidencia_id=ANY($1::uuid[]) ORDER BY blob_nombre", [[...evidenciaIds]]);
  return filas.rows.map(f => ({ contenedor: CONTENEDOR_EVIDENCIAS, ruta: f.blob_nombre }));
}

/**
 * La evidencia compartida con un hermano se elimina completa: prima la privacidad (supuesto A-07).
 * Las justificaciones del hermano se conservan sin evidencia y con su evento.
 */
async function alRetirarConsentimiento(catequizandoId: string, tx: Tx): Promise<{ blobs: RefBlob[]; cantidad: number }> {
  await exigirContextoRetencion(tx);
  const propias = await tx.query<{ evidencia_id: string }>("SELECT evidencia_id FROM justificacion WHERE catequizando_id=$1 ORDER BY id FOR UPDATE", [catequizandoId]);
  const evidencias = [...new Set(propias.rows.map(f => f.evidencia_id))].sort();
  const blobs = await blobsDe(tx, evidencias);
  for (const id of evidencias) await tx.query("SELECT marcar_evidencia_eliminada($1,'consentimiento')", [id]);
  await tx.query(`INSERT INTO justificacion_evento(justificacion_id,tipo,detalle)
    SELECT id,'evidencia_eliminada','{"motivo":"consentimiento"}'::jsonb FROM justificacion WHERE evidencia_id=ANY($1::uuid[]) AND catequizando_id<>$2`, [evidencias, catequizandoId]);
  await tx.query("DELETE FROM justificacion_evento WHERE justificacion_id IN (SELECT id FROM justificacion WHERE catequizando_id=$1)", [catequizandoId]);
  const borradas = await tx.query("DELETE FROM justificacion WHERE catequizando_id=$1", [catequizandoId]);
  return { blobs, cantidad: borradas.rowCount ?? 0 };
}

/** Al vencer la retención del ciclo no queda nada que conservar: se borran justificaciones y evidencias. */
async function alVencerCiclo(cicloId: string, tx: Tx): Promise<{ blobs: RefBlob[]; cantidad: number }> {
  await exigirContextoRetencion(tx);
  const evidencias = (await tx.query<{ id: string }>("SELECT id FROM evidencia WHERE ciclo_id=$1 ORDER BY id FOR UPDATE", [cicloId])).rows.map(f => f.id);
  const blobs = await blobsDe(tx, evidencias);
  await tx.query("DELETE FROM justificacion_evento WHERE justificacion_id IN (SELECT id FROM justificacion WHERE ciclo_id=$1)", [cicloId]);
  const borradas = await tx.query("DELETE FROM justificacion WHERE ciclo_id=$1", [cicloId]);
  await tx.query("DELETE FROM evidencia_archivo WHERE evidencia_id=ANY($1::uuid[])", [evidencias]);
  await tx.query("DELETE FROM evidencia WHERE ciclo_id=$1", [cicloId]);
  return { blobs, cantidad: borradas.rowCount ?? 0 };
}

export const participanteRetencionJustificaciones = {
  nombre: "justificaciones",
  tablas: ["justificacion"],
  alRetirarConsentimiento,
  alVencerCiclo,
};

/**
 * El motor de 001 borra los blobs después del commit. Las evidencias usan la identidad administrada
 * de su almacén (D-402), no `BLOBS_CONEXION`: sus rutas se desvían al almacén de 004.
 */
export function crearBorradorConEvidencias(otros: BorradorBlobs, almacen: () => AlmacenEvidencias = obtenerAlmacenEvidencias): BorradorBlobs {
  return { borrar: ref => (ref.contenedor === CONTENEDOR_EVIDENCIAS ? almacen().borrar(ref.ruta) : otros.borrar(ref)) };
}

/**
 * Puerto para 008: borra por prefijo `{cicloId}/` lo que quede del ciclo en Blob, aunque no tenga
 * fila (reservas a medio subir). Es idempotente; las filas las depura `alVencerCiclo`.
 */
export async function eliminarEvidenciasDeCiclo(cicloId: string, almacen: AlmacenEvidencias = obtenerAlmacenEvidencias()): Promise<number> {
  if (!/^[0-9a-f-]{36}$/i.test(cicloId)) throw new ErrorAplicacion(422, "ciclo_invalido");
  return almacen.borrarPrefijo(`${cicloId}/`);
}
