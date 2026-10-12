import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { puedeGestionarInscripciones } from "@/lib/catequizandos/autorizacion";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearNino, cicloAbierto } from "../infraestructura/comun";
async function exigirRetencion(tx: Tx) {
  const r = await tx.query<{ autorizado: boolean }>("SELECT current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retiro_consentimiento','retencion') AS autorizado");
  if (!r.rows[0].autorizado) throw new ErrorAplicacion(403, "fuera_de_alcance");
}
export async function eliminarDatosRestringidos(catequizandoId: string, tx: Tx) {
  await exigirRetencion(tx);
  await tx.query("DELETE FROM condicion_catequizando WHERE catequizando_id=$1", [catequizandoId]);
  await tx.query("DELETE FROM documento_inscripcion WHERE inscripcion_id IN (SELECT id FROM inscripcion WHERE catequizando_id=$1)", [catequizandoId]);
  await tx.query("DELETE FROM cambio_inscripcion WHERE catequizando_id=$1", [catequizandoId]);
  await tx.query("DELETE FROM referencia_duplicado WHERE catequizando_id=$1", [catequizandoId]);
}
export async function anonimizarCatequizando(catequizandoId: string, tx: Tx) {
  await exigirRetencion(tx);
  await tx.query("SELECT id FROM catequizando WHERE id=$1 FOR UPDATE", [catequizandoId]);
  const necesita = await tx.query("SELECT i.id FROM inscripcion i JOIN ciclo c ON c.id=i.ciclo_id WHERE i.catequizando_id=$1 AND current_setting('sigecat.contexto',true)='retencion' AND (c.estado='abierto' OR c.cerrado_en IS NULL OR c.cerrado_en>clock_timestamp()-interval '2 years') LIMIT 1", [catequizandoId]);
  if (necesita.rowCount) throw new ErrorAplicacion(409, "perfil_aun_necesario");
  await eliminarDatosRestringidos(catequizandoId, tx);
  const apoderados = await tx.query<{ id: string; cuenta_id: string }>("SELECT a.id,a.cuenta_id FROM apoderado a JOIN vinculo_apoderado v ON v.apoderado_id=a.id WHERE v.catequizando_id=$1 FOR UPDATE OF a", [catequizandoId]);
  await tx.query("UPDATE asignacion_grupo SET hasta=COALESCE(hasta,clock_timestamp()),motivo=NULL WHERE inscripcion_id IN (SELECT id FROM inscripcion WHERE catequizando_id=$1)", [catequizandoId]);
  await tx.query("UPDATE inscripcion SET estado='anulada',hasta=COALESCE(hasta,clock_timestamp()),anulada_en=COALESCE(anulada_en,clock_timestamp()),motivo_anulacion='Datos retirados',huella_peticion='' WHERE catequizando_id=$1", [catequizandoId]);
  await tx.query("UPDATE carne_emision SET invalidada_en=COALESCE(invalidada_en,clock_timestamp()) WHERE catequizando_id=$1", [catequizandoId]);
  await tx.query("UPDATE vinculo_apoderado SET vigente_hasta=COALESCE(vigente_hasta,clock_timestamp()),detalle_relacion=NULL WHERE catequizando_id=$1", [catequizandoId]);
  await tx.query("UPDATE catequizando SET nombres='',apellidos='',fecha_nacimiento=NULL,sexo='femenino',bautizado=false,clave_duplicado=NULL,estado='anonimizado',actualizado_en=clock_timestamp() WHERE id=$1", [catequizandoId]);
  for (const a of apoderados.rows) {
    if (!(await tx.query("SELECT id FROM vinculo_apoderado WHERE apoderado_id=$1 AND vigente_hasta IS NULL", [a.id])).rowCount) {
      await tx.query("UPDATE apoderado SET nombres='',apellidos='',valor_contacto='retirado',tipo_contacto='otro' WHERE id=$1", [a.id]);
      await tx.query("UPDATE credencial SET estado='terminada',terminada_en=COALESCE(terminada_en,clock_timestamp()),motivo_fin='sin_vinculos' WHERE cuenta_id=$1 AND tipo='familia' AND estado<>'terminada'", [a.cuenta_id]);
      // Una cuenta del equipo puede ser también apoderada: su identidad operativa sigue siendo necesaria.
      const familia = await tx.query<{ id: string }>("UPDATE cuenta c SET identidad_operativa='Familia retirada ' || c.id::text WHERE c.id=$1 AND EXISTS(SELECT 1 FROM rol_cuenta r WHERE r.cuenta_id=c.id AND r.rol='familia') AND NOT EXISTS(SELECT 1 FROM rol_cuenta r WHERE r.cuenta_id=c.id AND r.rol<>'familia') AND NOT EXISTS(SELECT 1 FROM apoderado otro JOIN vinculo_apoderado v ON v.apoderado_id=otro.id WHERE otro.cuenta_id=c.id AND v.vigente_hasta IS NULL) RETURNING c.id", [a.cuenta_id]);
      if (familia.rows[0]) await tx.query("DELETE FROM identidad_real WHERE cuenta_id=$1", [familia.rows[0].id]);
    }
  }
}
export const participanteRetencion = {
  nombre: "catequizandos",
  tablas: ["catequizando", "apoderado", "vinculo_apoderado", "grupo", "grupo_catequista", "inscripcion", "asignacion_grupo", "carne_emision", "cambio_inscripcion", "documento_inscripcion", "condicion_catequizando", "referencia_duplicado"],
  async alRetirarConsentimiento(catequizandoId: string, tx: Tx) { await anonimizarCatequizando(catequizandoId, tx); return { blobs: [], cantidad: 1 }; },
  async alVencerCiclo(cicloId: string, tx: Tx) {
    await exigirRetencion(tx);
    if (!(await tx.query("SELECT id FROM ciclo WHERE id=$1 AND estado='cerrado' AND cerrado_en<=clock_timestamp()-interval '2 years' FOR UPDATE", [cicloId])).rowCount) throw new ErrorAplicacion(409, "ciclo_aun_no_vencido");
    const ninos = await tx.query<{ catequizando_id: string }>(`SELECT DISTINCT i.catequizando_id FROM inscripcion i WHERE i.ciclo_id=$1 AND NOT EXISTS(
      SELECT 1 FROM inscripcion otra JOIN ciclo c ON c.id=otra.ciclo_id WHERE otra.catequizando_id=i.catequizando_id AND otra.ciclo_id<>$1 AND (c.estado='abierto' OR c.cerrado_en IS NULL OR c.cerrado_en>clock_timestamp()-interval '2 years')) ORDER BY i.catequizando_id`, [cicloId]);
    for (const n of ninos.rows) await anonimizarCatequizando(n.catequizando_id, tx);
    await tx.query("DELETE FROM cambio_inscripcion WHERE entidad_id IN (SELECT id FROM inscripcion WHERE ciclo_id=$1 UNION SELECT d.id FROM documento_inscripcion d JOIN inscripcion i ON i.id=d.inscripcion_id WHERE i.ciclo_id=$1 UNION SELECT a.id FROM asignacion_grupo a JOIN inscripcion i ON i.id=a.inscripcion_id WHERE i.ciclo_id=$1)", [cicloId]);
    await tx.query("DELETE FROM documento_inscripcion WHERE inscripcion_id IN (SELECT id FROM inscripcion WHERE ciclo_id=$1)", [cicloId]);
    return { blobs: [], cantidad: ninos.rows.length };
  }
};
export async function marcarInactivo(tx: Tx, catequizandoId: string, contexto: ContextoAcceso) {
  if (!puedeGestionarInscripciones(contexto)) throw new ErrorAplicacion(403, "fuera_de_alcance");
  await cicloAbierto(tx);
  await bloquearNino(tx, catequizandoId);
  await tx.query("UPDATE asignacion_grupo SET hasta=clock_timestamp() WHERE hasta IS NULL AND inscripcion_id IN (SELECT i.id FROM inscripcion i JOIN ciclo c ON c.id=i.ciclo_id WHERE i.catequizando_id=$1 AND c.estado='abierto')", [catequizandoId]);
  await tx.query("UPDATE inscripcion SET hasta=clock_timestamp() WHERE catequizando_id=$1 AND hasta IS NULL AND ciclo_id IN (SELECT id FROM ciclo WHERE estado='abierto')", [catequizandoId]);
  await tx.query("UPDATE catequizando SET estado='inactivo',actualizado_en=clock_timestamp() WHERE id=$1", [catequizandoId]);
  await tx.query("UPDATE carne_emision SET invalidada_en=clock_timestamp() WHERE catequizando_id=$1 AND invalidada_en IS NULL", [catequizandoId]);
}
