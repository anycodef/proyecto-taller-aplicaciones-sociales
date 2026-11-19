import type { Justificacion } from "./tipos";

export type EstadoParaRiesgo = "aprobada" | "pendiente" | "rechazada" | "ninguna";
type Ninio = { catequizandoId: string; fecha: string };

const conEfecto = (j: Justificacion) => !j.sinEfectoDesde;
const aprobadaVigente = (j: Justificacion) => conEfecto(j) && j.estadoRevision === "aprobada";

/** Basta una aprobada de esa fecha, de misa o de catequesis, como dice RF-311 (supuesto A-13). */
export function faltaJustificada(fecha: string, catequizandoId: string, justificaciones: readonly Justificacion[]): boolean {
  return justificaciones.some(j => aprobadaVigente(j) && j.catequizandoId === catequizandoId && j.fecha === fecha);
}

/** Para 006: la ausencia a misa aprobada no cuenta en contra de la aptitud. */
export function ausenciaMisaJustificada(sesionId: string, catequizandoId: string, justificaciones: readonly Justificacion[]): boolean {
  return justificaciones.some(j => aprobadaVigente(j) && j.tipoSesion === "misa" && j.sesionId === sesionId && j.catequizandoId === catequizandoId);
}

/** Para 007: la aprobada prevalece sobre la pendiente y esta sobre la rechazada. */
export function estadoParaRiesgo(ausencia: Ninio, justificaciones: readonly Justificacion[]): EstadoParaRiesgo {
  const propias = justificaciones.filter(j => conEfecto(j) && j.catequizandoId === ausencia.catequizandoId && j.fecha === ausencia.fecha);
  for (const estado of ["aprobada", "pendiente", "rechazada"] as const) if (propias.some(j => j.estadoRevision === estado)) return estado;
  return "ninguna";
}

/** Entrada de `faltasDelCiclo` de 003: solo fechas con una aprobada vigente. */
export function fechasJustificadas(justificaciones: readonly Justificacion[]): Ninio[] {
  const vistas = new Map<string, Ninio>();
  for (const j of justificaciones.filter(aprobadaVigente)) vistas.set(`${j.catequizandoId}|${j.fecha}`, { catequizandoId: j.catequizandoId, fecha: j.fecha });
  return [...vistas.values()];
}
