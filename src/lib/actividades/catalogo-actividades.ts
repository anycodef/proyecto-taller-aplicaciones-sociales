import { fechaValida } from "@/lib/asistencia/sesiones";
export const TIPOS_ACTIVIDAD = ["jornada", "retiro", "viacrucis", "posada", "misa_precepto", "semana_santa"] as const;
export type TipoActividad = typeof TIPOS_ACTIVIDAD[number];
export interface Actividad { id: string; cicloId: string; nombre: string; tipo: TipoActividad; fecha: string; estado: "vigente" | "cancelada" }
export function validarActividad(actividad: Actividad): boolean {
  return actividad.nombre.trim().length > 0 && actividad.nombre.trim().length <= 150 && TIPOS_ACTIVIDAD.includes(actividad.tipo) && fechaValida(actividad.fecha) && ["vigente", "cancelada"].includes(actividad.estado);
}
export const puedeReprogramar = (_actividad: Actividad, tieneAsistencias: boolean): boolean => !tieneAsistencias;
