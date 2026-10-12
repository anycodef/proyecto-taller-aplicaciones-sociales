import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { TipoActividad } from "@/lib/actividades/catalogo-actividades";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { aplicarPush } from "../../sincronizacion/aplicacion/push";
import type { EntradaActividad } from "../dominio/validacion";
export interface AltaActividad { id: string; cicloId: string; nombre: string; tipo: TipoActividad; fecha: string; estado: "vigente" | "cancelada" }
export type CambiosActividad = Partial<Pick<AltaActividad, "nombre" | "tipo" | "fecha" | "estado">>;
export async function gestionarActividadHttp(datos: AltaActividad | { id: string; cambios: CambiosActividad }, ctx: ContextoAcceso, tx: Tx) {
  const anterior = (await tx.query<EntradaActividad>("SELECT *,fecha::text FROM actividad_obligatoria WHERE id=$1", [datos.id])).rows[0];
  const actualizar = "cambios" in datos;
  if (actualizar && !anterior) throw new ErrorAplicacion(404, "actividad_no_disponible");
  const fila: EntradaActividad = actualizar ? { ...anterior, ...datos.cambios, cuenta_id: ctx.cuentaId, credencial_id: ctx.credencialId, dispositivo_id: ctx.dispositivoId! } : {
    id: datos.id, ciclo_id: datos.cicloId, nombre: datos.nombre, tipo: datos.tipo, fecha: datos.fecha, estado: datos.estado,
    creado_por: ctx.cuentaId, cuenta_id: ctx.cuentaId, credencial_id: ctx.credencialId, dispositivo_id: ctx.dispositivoId!,
  };
  // Nunca se envían columnas de control leídas de PostgreSQL al validador estricto.
  const entrada: EntradaActividad = { id: fila.id, ciclo_id: fila.ciclo_id, nombre: fila.nombre, tipo: fila.tipo, fecha: fila.fecha, estado: fila.estado, creado_por: fila.creado_por, cuenta_id: fila.cuenta_id, credencial_id: fila.credencial_id, dispositivo_id: fila.dispositivo_id };
  const resumen = await aplicarPush({ changes: { actividades_obligatorias: { created: actualizar ? [] : [entrada], updated: actualizar ? [entrada] : [], deleted: [] } } }, ctx, tx);
  // Responder conflicto sin lanzar permite conservar el aviso durable del rechazo.
  return resumen.aceptados ? { estadoHttp: actualizar || anterior ? 200 : 201, cuerpo: { actividad: { id: fila.id, cicloId: fila.ciclo_id, nombre: fila.nombre, tipo: fila.tipo, fecha: fila.fecha, estado: fila.estado } } } :
    { estadoHttp: 409, cuerpo: { codigo: resumen.descartadosCierre ? "ciclo_no_abierto" : "actividad_rechazada" } };
}
