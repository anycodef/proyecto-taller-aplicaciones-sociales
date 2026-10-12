import type { Tx } from "../../../compartido/bd/transaccion";
import type { Sesion } from "@/lib/asistencia/tipos";
export interface FuenteInscripciones {
  activosEnFecha(cicloId: string, fecha: string, tx: Tx): Promise<{ catequizandoId: string; grupoId: string; nombre: string }[]>;
}
export interface FuenteJustificacionesAprobadas {
  consultar(cicloId: string, tx: Tx): Promise<{ catequizandoId: string; fecha: string }[]>;
}
export type AlCambiarAsistencia = (evento: { cicloId: string; catequizandoId: string; fecha: string }, tx: Tx) => Promise<void>;
export const fuenteJustificacionesVacia: FuenteJustificacionesAprobadas = { consultar: async () => [] };
let justificaciones: FuenteJustificacionesAprobadas = fuenteJustificacionesVacia;
let alCambiar: AlCambiarAsistencia | undefined;
let actividadSumaFalta: (sesion: Sesion) => boolean = sesion => sesion.tipoActividad === "jornada";
export function registrarFuenteJustificaciones(fuente: FuenteJustificacionesAprobadas): void { justificaciones = fuente; }
export const obtenerFuenteJustificaciones = (): FuenteJustificacionesAprobadas => justificaciones;
export function registrarAlCambiarAsistencia(puerto: AlCambiarAsistencia): void { alCambiar = puerto; }
export async function notificarCambio(evento: Parameters<AlCambiarAsistencia>[0], tx: Tx): Promise<void> { await alCambiar?.(evento, tx); }
export function registrarActividadSumaFalta(predicado: (sesion: Sesion) => boolean): void { actividadSumaFalta = predicado; }
export const obtenerActividadSumaFalta = (): ((sesion: Sesion) => boolean) => actividadSumaFalta;
