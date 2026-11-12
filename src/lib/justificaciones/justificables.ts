import { hoyEnLima } from "@/lib/seguridad/fechas";
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

export type FilaAusencias = { catequizandoId: string; fecha: string; ausencias: AusenciaRef[] };

/** Misa y catequesis del mismo domingo van en una fila para justificarse juntas (supuesto A-13). */
export function agruparPorDomingo(ausencias: readonly AusenciaRef[]): FilaAusencias[] {
  const filas = new Map<string, FilaAusencias>();
  for (const a of ausencias) {
    const clave = a.tipoSesion === "actividad" ? `${a.catequizandoId}|${a.fecha}|${a.sesionId}` : `${a.catequizandoId}|${a.fecha}|domingo`;
    const fila = filas.get(clave) ?? { catequizandoId: a.catequizandoId, fecha: a.fecha, ausencias: [] };
    fila.ausencias.push(a);
    filas.set(clave, fila);
  }
  return [...filas.values()].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.catequizandoId.localeCompare(y.catequizandoId));
}

export type SesionFutura = { id: string; cicloId: string; fecha: string; tipo: AusenciaRef["tipoSesion"]; cancelada: boolean };

/** Sin antelación mínima: cualquier sesión futura del ciclo abierto (supuesto A-03). */
export function sesionesAnticipables(entrada: {
  sesiones: readonly SesionFutura[];
  catequizandoIds: readonly string[];
  justificaciones: readonly Justificacion[];
  cicloId: string;
  ahora: Date;
}): AusenciaRef[] {
  const hoy = hoyEnLima(entrada.ahora);
  const futuras = entrada.sesiones.filter(s => s.cicloId === entrada.cicloId && !s.cancelada && s.fecha > hoy);
  return entrada.catequizandoIds.flatMap(catequizandoId =>
    futuras
      .map(s => ({ catequizandoId, sesionId: s.id, tipoSesion: s.tipo, fecha: s.fecha }))
      .filter(a => !tieneJustificacionActiva(a, entrada.justificaciones)),
  );
}
