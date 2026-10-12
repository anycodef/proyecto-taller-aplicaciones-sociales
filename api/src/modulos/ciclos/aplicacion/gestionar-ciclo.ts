import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { validarAperturaCiclo, type Ciclo } from "@/lib/ciclos/ciclo";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { generarSesionesDominicales } from "../../asistencia/aplicacion/generar-sesiones";
import { recalcularMinoria, terminarDelegacionesVigentes, revocarEnlacesFamilia } from "../../seguridad/aplicacion/servicios-cierre";
import { auditar } from "../../seguridad/aplicacion/auditar";
export const seleccionCiclo = 'id,nombre,inicio::text AS "fechaInicio",fin::text AS "fechaFin",estado,abierto_en AS "abiertoEn",cerrado_en AS "cerradoEn",depurado_en AS "depuradoEn"';
function exigirAdministracion(ctx: ContextoAcceso): void {
  if (!ctx.rolesPropios.includes("administracion")) throw new ErrorAplicacion(403, "fuera_de_alcance");
}
export async function abrirCiclo(datos: Omit<Ciclo, "estado">, ctx: ContextoAcceso, tx: Tx): Promise<{ ciclo: Ciclo; creado: boolean }> {
  exigirAdministracion(ctx);
  if (!validarAperturaCiclo(datos, null)) throw new ErrorAplicacion(400, "entrada_invalida");
  await tx.query("SELECT pg_advisory_xact_lock(8001)");
  const existente = (await tx.query<Ciclo>(`SELECT ${seleccionCiclo} FROM ciclo WHERE id=$1`, [datos.id])).rows[0];
  if (existente) {
    if (existente.nombre !== datos.nombre || existente.fechaInicio !== datos.fechaInicio || existente.fechaFin !== datos.fechaFin) throw new ErrorAplicacion(409, "uuid_reutilizado");
    return { ciclo: existente, creado: false };
  }
  if ((await tx.query("SELECT id FROM ciclo WHERE estado='abierto'")).rowCount) throw new ErrorAplicacion(409, "ciclo_abierto_existente");
  const ciclo = (await tx.query<Ciclo>(`INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,$2,$3,$4,$5) RETURNING ${seleccionCiclo}`, [datos.id, datos.nombre, datos.fechaInicio, datos.fechaFin, ctx.cuentaId])).rows[0];
  await generarSesionesDominicales(datos.id, tx);
  // El puerto de minoría eleva privilegios: se restablecen antes de continuar la petición.
  const anterior = (await tx.query<{ rol: string; contexto: string | null }>("SELECT current_user AS rol,current_setting('sigecat.contexto',true) AS contexto")).rows[0];
  await recalcularMinoria(datos.fechaInicio, tx);
  await tx.query("SELECT set_config('role',$1,true)", [anterior.rol]);
  await tx.query("SELECT set_config('sigecat.contexto',$1,true)", [anterior.contexto ?? ""]);
  await auditar(ctx, { accion: "ciclo:abrir", recursoTipo: "ciclo", recursoId: datos.id, resultado: "permitido" }, tx);
  return { ciclo, creado: true };
}
export async function cerrarCiclo(id: string, ctx: ContextoAcceso, tx: Tx) {
  exigirAdministracion(ctx);
  await tx.query("SELECT pg_advisory_xact_lock(8001)");
  const ciclo = (await tx.query<{ estado: string; cerradoEn: Date | null }>('SELECT estado,cerrado_en AS "cerradoEn" FROM ciclo WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!ciclo) throw new ErrorAplicacion(404, "ciclo_no_disponible");
  async function efectos(cerradoEn: Date | null) {
    const delegaciones = await tx.query<{ cantidad: number }>("SELECT count(*)::int AS cantidad FROM delegacion WHERE terminada_por_cierre AND date_trunc('milliseconds',revocada_en)=$1", [cerradoEn]);
    const enlaces = await tx.query<{ cantidad: number }>("SELECT count(*)::int AS cantidad FROM credencial WHERE tipo='familia' AND motivo_fin='cierre_ciclo' AND date_trunc('milliseconds',terminada_en)=$1", [cerradoEn]);
    return { delegacionesTerminadas: delegaciones.rows[0].cantidad, enlacesRevocados: enlaces.rows[0].cantidad };
  }
  if (ciclo.estado === "cerrado") return { cerradoEn: ciclo.cerradoEn, efectos: await efectos(ciclo.cerradoEn) };
  await terminarDelegacionesVigentes(tx);
  const familias = await tx.query<{ cuenta_id: string }>("SELECT DISTINCT cuenta_id FROM credencial WHERE tipo='familia' AND estado<>'terminada'");
  await revocarEnlacesFamilia(familias.rows.map(fila => fila.cuenta_id), tx);
  const cerrado = await tx.query<{ cerradoEn: Date }>('UPDATE ciclo SET estado=\'cerrado\',cerrado_por=$2,cerrado_en=now() WHERE id=$1 RETURNING cerrado_en AS "cerradoEn"', [id, ctx.cuentaId]);
  await auditar(ctx, { accion: "ciclo:cerrar", recursoTipo: "ciclo", recursoId: id, resultado: "permitido", detalle: { motivo: "cierre_ciclo", cantidad: familias.rows.length } }, tx);
  return { cerradoEn: cerrado.rows[0].cerradoEn, efectos: await efectos(cerrado.rows[0].cerradoEn) };
}
