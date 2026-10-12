import { fechaValida } from "@/lib/asistencia/sesiones";
export type EstadoCiclo = "abierto" | "cerrado";
export interface Ciclo { id: string; nombre: string; fechaInicio: string; fechaFin: string; estado: EstadoCiclo }
export function validarAperturaCiclo(datos: Omit<Ciclo, "estado">, abierto: Ciclo | null): boolean {
  return !abierto && datos.nombre.trim().length > 0 && datos.nombre.trim().length <= 150 && fechaValida(datos.fechaInicio) && fechaValida(datos.fechaFin) && datos.fechaFin > datos.fechaInicio;
}
export const puedeCrearRegistrosLocales = (ciclo: Ciclo | null): boolean => ciclo?.estado === "abierto";
export function transicionCiclo(estado: EstadoCiclo, accion: "cerrar" | "reabrir"): EstadoCiclo {
  if (accion === "reabrir") throw new Error("ciclo_no_reabrible");
  return "cerrado";
}
