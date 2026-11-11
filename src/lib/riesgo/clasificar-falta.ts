import type { EstadoFalta, FaltaParaClasificar, Justificacion } from "./tipos";

export function clasificarFalta(
  falta: FaltaParaClasificar,
  justificaciones: Justificacion[],
  ahora: Date,
): EstadoFalta {
  const deLaFecha = justificaciones.filter(
    (justificacion) =>
      justificacion.catequizandoId === falta.catequizandoId && justificacion.fecha === falta.fecha,
  );

  if (falta.justificada || deLaFecha.some((justificacion) => justificacion.estado === "aprobada")) {
    return "justificada";
  }

  if (!falta.venceEn) {
    return "suma";
  }

  const vencimiento = Date.parse(falta.venceEn);
  if (!Number.isFinite(vencimiento)) {
    return "suma";
  }

  if (ahora.getTime() < vencimiento) {
    return "pendiente_justificar";
  }

  if (deLaFecha.some((justificacion) => justificacion.estado === "pendiente")) {
    return "en_revision";
  }

  return "suma";
}
