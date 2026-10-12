import { randomUUID } from "node:crypto";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { encolarLapidasRetencion } from "../infraestructura/lapidas-sincronizacion";
async function anonimizar(catequizandoId: string, tx: Tx, cicloId?: string): Promise<number> {
  const permiso = await tx.query<{ autorizado: boolean }>("SELECT current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retiro_consentimiento','retencion') AS autorizado");
  if (!permiso.rows[0]?.autorizado) throw new ErrorAplicacion(403, "fuera_de_alcance");
  await tx.query("SELECT id FROM catequizando WHERE id=$1 FOR UPDATE", [catequizandoId]);
  await encolarLapidasRetencion(tx, { catequizandoId, cicloId });
  const estadisticoId = randomUUID();
  const filtro = "catequizando_id=$1 AND ($3::uuid IS NULL OR ciclo_id=$3)";
  const valores = [catequizandoId, estadisticoId, cicloId ?? null];
  const consolidadas = await tx.query(`UPDATE asistencia SET catequizando_id=NULL,estadistico_id=$2,id=gen_random_uuid(),eliminado_en=clock_timestamp() WHERE ${filtro}`, valores);
  await tx.query(`UPDATE marca_asistencia SET catequizando_id=NULL,estadistico_id=$2,codigo_leido=NULL,registrado_por=NULL,cuenta_id=NULL,credencial_id=NULL,dispositivo_id=NULL,lista_id=NULL,huella_peticion='',motivo_rechazo=NULL,eliminado_en=clock_timestamp()
    WHERE (catequizando_id=$1 OR position(lower($1::text) in lower(COALESCE(codigo_leido,'')))>0) AND ($3::uuid IS NULL OR ciclo_id=$3)`, valores);
  await tx.query(`UPDATE correccion_asistencia SET catequizando_id=NULL,estadistico_id=$2,corregido_por=NULL,cuenta_id=NULL,credencial_id=NULL,dispositivo_id=NULL,motivo=NULL,huella_peticion='',motivo_rechazo=NULL,eliminado_en=clock_timestamp() WHERE ${filtro}`, valores);
  await tx.query(`UPDATE aviso_asistencia SET catequizando_id=NULL,estadistico_id=$2,detalle='{}',atendido_por=NULL,eliminado_en=clock_timestamp() WHERE ${filtro}`, valores);
  await tx.query(`UPDATE evento_asistencia SET catequizando_id=NULL,estadistico_id=$2 WHERE ${filtro}`, valores);
  return consolidadas.rowCount ?? 0;
}
export const participanteRetencionAsistencia = {
  nombre: "asistencia",
  tablas: ["asistencia", "marca_asistencia", "correccion_asistencia", "aviso_asistencia", "evento_asistencia"],
  async alRetirarConsentimiento(catequizandoId: string, tx: Tx) { return { blobs: [], cantidad: await anonimizar(catequizandoId, tx) }; },
  async alVencerCiclo(cicloId: string, tx: Tx) {
    await tx.query("SELECT n.id FROM catequizando n WHERE EXISTS(SELECT 1 FROM inscripcion i WHERE i.catequizando_id=n.id AND i.ciclo_id=$1) ORDER BY n.id FOR UPDATE OF n", [cicloId]);
    await encolarLapidasRetencion(tx, { cicloId });
    const ninos = await tx.query<{ catequizando_id: string }>(`SELECT DISTINCT catequizando_id FROM asistencia WHERE ciclo_id=$1 AND catequizando_id IS NOT NULL
      UNION SELECT DISTINCT catequizando_id FROM marca_asistencia WHERE ciclo_id=$1 AND catequizando_id IS NOT NULL
      UNION SELECT DISTINCT catequizando_id FROM correccion_asistencia WHERE ciclo_id=$1 AND catequizando_id IS NOT NULL
      UNION SELECT DISTINCT catequizando_id FROM aviso_asistencia WHERE ciclo_id=$1 AND catequizando_id IS NOT NULL
      UNION SELECT DISTINCT catequizando_id FROM evento_asistencia WHERE ciclo_id=$1 AND catequizando_id IS NOT NULL ORDER BY catequizando_id`, [cicloId]);
    let cantidad = 0;
    for (const nino of ninos.rows) cantidad += await anonimizar(nino.catequizando_id, tx, cicloId);
    await tx.query("UPDATE lista_asistencia SET confirmada_por=NULL,cuenta_id=NULL,credencial_id=NULL,dispositivo_id=NULL,grupo_id=NULL,huella_peticion='',motivo_rechazo=NULL,eliminado_en=clock_timestamp() WHERE ciclo_id=$1", [cicloId]);
    await tx.query("UPDATE marca_asistencia SET codigo_leido=NULL,registrado_por=NULL,cuenta_id=NULL,credencial_id=NULL,dispositivo_id=NULL,huella_peticion='',motivo_rechazo=NULL,eliminado_en=clock_timestamp() WHERE ciclo_id=$1", [cicloId]);
    await tx.query("UPDATE aviso_asistencia SET detalle='{}',atendido_por=NULL,eliminado_en=clock_timestamp() WHERE ciclo_id=$1", [cicloId]);
    return { blobs: [], cantidad };
  },
};
