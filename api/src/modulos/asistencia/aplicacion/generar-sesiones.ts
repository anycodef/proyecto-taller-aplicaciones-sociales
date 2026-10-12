import { domingosDelCiclo, idSesion } from "@/lib/asistencia/sesiones";
import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
export async function generarSesionesDominicales(cicloId?: string, tx?: Tx): Promise<number> {
  if (!tx) return enTransaccion(transaccion => generarSesionesDominicales(cicloId, transaccion));
  const ciclos = await tx.query<{ id: string; inicio: string; fin: string }>("SELECT id,inicio::text,fin::text FROM ciclo WHERE estado='abierto' AND ($1::uuid IS NULL OR id=$1) FOR SHARE", [cicloId ?? null]);
  let creadas = 0;
  for (const ciclo of ciclos.rows) {
    await tx.query("INSERT INTO parametros_asistencia_ciclo(ciclo_id) VALUES($1) ON CONFLICT DO NOTHING", [ciclo.id]);
    for (const fecha of domingosDelCiclo(ciclo.inicio, ciclo.fin)) for (const tipo of ["misa", "catequesis"] as const) {
      const resultado = await tx.query("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING", [idSesion(ciclo.id, fecha, tipo), ciclo.id, fecha, tipo]);
      creadas += resultado.rowCount ?? 0;
    }
  }
  return creadas;
}
export async function crearSesionActividad(actividadId: string, tx?: Tx): Promise<string> {
  if (!tx) return enTransaccion(transaccion => crearSesionActividad(actividadId, transaccion));
  const resultado = await tx.query<{ ciclo_id: string; fecha: string; estado: string }>("SELECT a.ciclo_id,a.fecha::text,a.estado FROM actividad_obligatoria a JOIN ciclo c ON c.id=a.ciclo_id AND c.estado='abierto' WHERE a.id=$1 FOR SHARE OF a,c", [actividadId]);
  const actividad = resultado.rows[0];
  if (!actividad || actividad.estado === "cancelada") throw new ErrorAplicacion(409, "actividad_no_disponible");
  const id = idSesion(actividad.ciclo_id, actividad.fecha, "actividad", actividadId);
  await tx.query("INSERT INTO sesion(id,ciclo_id,fecha,tipo,actividad_id) VALUES($1,$2,$3,'actividad',$4) ON CONFLICT(id) DO NOTHING", [id, actividad.ciclo_id, actividad.fecha, actividadId]);
  return id;
}
