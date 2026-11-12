import { plazoVigente } from "./plazo";
import type { AusenciaRef, Justificacion } from "./tipos";

function mismaAusencia(a: Pick<AusenciaRef, "catequizandoId" | "sesionId">, b: Pick<AusenciaRef, "catequizandoId" | "sesionId">): boolean {
  return a.catequizandoId === b.catequizandoId && a.sesionId === b.sesionId;
}

/** Una pendiente o aprobada con efecto cubre la ausencia; una rechazada no (RF-408). */
export function tieneJustificacionActiva(ausencia: Pick<AusenciaRef, "catequizandoId" | "sesionId">, justificaciones: readonly Justificacion[]): boolean {
  return justificaciones.some(j => mismaAusencia(j, ausencia) && !j.sinEfectoDesde && j.estadoRevision !== "rechazada");
}

export function ausenciasJustificables(ausencias: readonly AusenciaRef[], justificaciones: readonly Justificacion[], diasPlazo: number, ahora: Date): AusenciaRef[] {
  return ausencias.filter(a => plazoVigente(a.fecha, diasPlazo, ahora) && !tieneJustificacionActiva(a, justificaciones));
}
