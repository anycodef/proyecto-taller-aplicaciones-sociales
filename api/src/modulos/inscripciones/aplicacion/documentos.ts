import type { z } from "zod";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { aplicarCambioDocumento, TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";
import type { EstadoDocumento } from "@/lib/catequizandos/modelo";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearNino, cambio, cicloAbierto } from "../../catequizandos/infraestructura/comun";
import type * as esquemas from "../../catequizandos/http/esquemas";
export async function documentosInscripcion(tx: Tx, id: string) {
  return (await tx.query('SELECT d.id,d.tipo,d.estado,d.motivo,d.fecha_estado::text AS "fechaEstado",c.identidad_operativa AS "recibidoPor" FROM documento_inscripcion d LEFT JOIN cuenta c ON c.id=d.recibido_por WHERE d.inscripcion_id=$1 ORDER BY d.tipo', [id])).rows;
}
async function bloquearInscripcion(tx: Tx, id: string) {
  const r = await tx.query<{ catequizando_id: string; ciclo_id: string; estado: string }>("SELECT catequizando_id,ciclo_id,estado FROM inscripcion WHERE id=$1", [id]);
  if (!r.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  await bloquearNino(tx, r.rows[0].catequizando_id);
  const vigente = await tx.query<{ estado: string }>("SELECT estado FROM inscripcion WHERE id=$1 FOR UPDATE", [id]);
  await cicloAbierto(tx, r.rows[0].ciclo_id);
  return { ...r.rows[0], estado: vigente.rows[0].estado };
}
export async function cambiarDocumento(tx: Tx, id: string, tipo: string, datos: z.infer<typeof esquemas.documento>, contexto: ContextoAcceso) {
  if (!TIPOS_DOCUMENTO.some(t => t === tipo)) throw new ErrorAplicacion(422, "tipo_documento_invalido");
  const i = await bloquearInscripcion(tx, id);
  if (i.estado !== "vigente") throw new ErrorAplicacion(409, "inscripcion_no_vigente");
  const r = await tx.query<{ id: string; estado: EstadoDocumento; fecha_estado: string; motivo: string | null }>("SELECT id,estado,fecha_estado::text,motivo FROM documento_inscripcion WHERE inscripcion_id=$1 AND tipo=$2 FOR UPDATE", [id, tipo]);
  if (!r.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const repetido = await tx.query("SELECT id FROM cambio_inscripcion WHERE id=$1 AND entidad_id=$2 AND valor_nuevo=$3::jsonb AND cambiado_por=$4", [datos.cambioId, r.rows[0].id, JSON.stringify({ estado: datos.estado, fechaEstado: datos.fechaEstado, motivo: datos.motivo ?? null }), contexto.cuentaId]);
  if (repetido.rowCount) return { documentoId: r.rows[0].id };
  const valido = aplicarCambioDocumento(r.rows[0].estado, datos);
  if (!valido.valido) throw new ErrorAplicacion(422, valido.codigo!);
  await cambio(tx, { id: datos.cambioId, catequizandoId: i.catequizando_id, entidad: "documento_inscripcion", entidadId: r.rows[0].id, campo: "estado", anterior: { estado: r.rows[0].estado, fechaEstado: r.rows[0].fecha_estado, motivo: r.rows[0].motivo }, nuevo: { estado: datos.estado, fechaEstado: datos.fechaEstado, motivo: datos.motivo ?? null }, cuentaId: contexto.cuentaId });
  await tx.query("UPDATE documento_inscripcion SET estado=$2,fecha_estado=$3,motivo=$4,recibido_por=$5 WHERE id=$1", [r.rows[0].id, datos.estado, datos.fechaEstado, datos.motivo ?? null, contexto.cuentaId]);
  return { documentoId: r.rows[0].id };
}
export async function anularInscripcion(tx: Tx, id: string, datos: z.infer<typeof esquemas.anular>, contexto: ContextoAcceso) {
  const i = await bloquearInscripcion(tx, id);
  if (i.estado === "anulada") {
    if (!(await tx.query("SELECT id FROM inscripcion WHERE id=$1 AND motivo_anulacion=$2 AND anulada_por=$3", [id, datos.motivo, contexto.cuentaId])).rowCount) throw new ErrorAplicacion(409, "anulacion_en_conflicto");
    return { inscripcionId: id, estado: "anulada" };
  }
  await cambio(tx, { id: datos.cambioId, catequizandoId: i.catequizando_id, entidad: "inscripcion", entidadId: id, campo: "estado", anterior: "vigente", nuevo: "anulada", cuentaId: contexto.cuentaId, motivo: datos.motivo });
  await tx.query("UPDATE inscripcion SET estado='anulada',hasta=clock_timestamp(),anulada_en=clock_timestamp(),anulada_por=$2,motivo_anulacion=$3 WHERE id=$1", [id, contexto.cuentaId, datos.motivo]);
  await tx.query("UPDATE asignacion_grupo SET hasta=clock_timestamp() WHERE inscripcion_id=$1 AND hasta IS NULL", [id]);
  await tx.query("UPDATE carne_emision SET invalidada_en=clock_timestamp() WHERE catequizando_id=$1 AND invalidada_en IS NULL", [i.catequizando_id]);
  return { inscripcionId: id, estado: "anulada" };
}
export async function listarDocumentosPendientes(tx: Tx, cicloId: string, grupoId?: string) {
  return (await tx.query(`SELECT i.id AS "inscripcionId",n.id AS "catequizandoId",n.nombres,n.apellidos,a.grupo_id AS "grupoId",d.tipo,d.estado,d.motivo,d.fecha_estado::text AS "fechaEstado"
    FROM inscripcion i JOIN catequizando n ON n.id=i.catequizando_id JOIN asignacion_grupo a ON a.inscripcion_id=i.id AND a.hasta IS NULL JOIN documento_inscripcion d ON d.inscripcion_id=i.id
    WHERE i.ciclo_id=$1 AND i.estado='vigente' AND n.estado='vigente' AND d.estado IN ('pendiente','invalido') AND ($2::uuid IS NULL OR a.grupo_id=$2) ORDER BY n.apellidos,n.nombres,d.tipo`, [cicloId, grupoId ?? null])).rows;
}
