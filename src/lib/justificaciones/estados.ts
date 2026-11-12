import { ErrorJustificacion, type EstadoVisible, type Justificacion } from "./tipos";

export type DecisionRevision = "aprobada" | "rechazada";
export const MOTIVO_RECHAZO_MAXIMO = 280;

/** Aprobar y rechazar son definitivos en el MVP (supuesto A-05). */
export function revisar(justificacion: Justificacion, decision: DecisionRevision, por: string, en: string, motivo?: string): Justificacion {
  if (justificacion.estadoRevision !== "pendiente") throw new ErrorJustificacion("no_pendiente");
  if (justificacion.sinEfectoDesde) throw new ErrorJustificacion("sin_efecto");
  const motivoLimpio = motivo?.trim() ?? "";
  if (decision === "rechazada" && !motivoLimpio) throw new ErrorJustificacion("motivo_requerido");
  if (motivoLimpio.length > MOTIVO_RECHAZO_MAXIMO) throw new ErrorJustificacion("motivo_largo");
  return {
    ...justificacion,
    estadoRevision: decision,
    revisadaPor: por,
    revisadaEn: en,
    motivoRechazo: decision === "rechazada" ? motivoLimpio : null,
  };
}

export function estadoVisible(justificacion: Justificacion): EstadoVisible {
  return justificacion.sinEfectoDesde ? "sin_efecto" : justificacion.estadoRevision;
}

/** Se marca y se conserva: la traza de la justificación no se pierde (RF-407, D-406). */
export function dejarSinEfecto(justificacion: Justificacion, en: string): Justificacion {
  return justificacion.sinEfectoDesde ? justificacion : { ...justificacion, sinEfectoDesde: en };
}

export function restaurarEfecto(justificacion: Justificacion): Justificacion {
  return justificacion.sinEfectoDesde ? { ...justificacion, sinEfectoDesde: null } : justificacion;
}
