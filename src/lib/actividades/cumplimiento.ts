import type { Actividad } from "./catalogo-actividades";
export type EstadoCumplimiento = "cumplida" | "no_cumplida" | "justificada" | "pendiente" | "cancelada" | "no_aplica";
export function estadoCumplimiento(actividad: Actividad, entrada: { activoEnFecha: boolean; presente: boolean; justificada: boolean; finalizada: boolean }): EstadoCumplimiento {
  if (actividad.estado === "cancelada") return "cancelada";
  if (!entrada.activoEnFecha) return "no_aplica";
  if (entrada.presente) return "cumplida";
  if (entrada.justificada) return "justificada";
  return entrada.finalizada ? "no_cumplida" : "pendiente";
}
