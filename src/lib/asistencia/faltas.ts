import { ventanaDe } from "./sesiones";
import type { EstadoEnSesion, Falta, ParametrosAsistencia, Sesion, ValorAsistencia } from "./tipos";
export function estadoEnSesion(sesion: Sesion, activoEnFecha: boolean, asistencia: ValorAsistencia | undefined, listaConfirmada: boolean, ahora: number, parametros?: ParametrosAsistencia): EstadoEnSesion {
  if (sesion.cancelada || !activoEnFecha) return "no_aplica";
  if (asistencia) return asistencia;
  if (sesion.tipo === "catequesis") return listaConfirmada ? "ausente" : "sin_registro";
  if (ahora <= ventanaDe(sesion, parametros).fin) return "pendiente";
  return "ausente";
}
export type EstadoPorSesion = { sesion: Sesion; catequizandoId: string; estado: EstadoEnSesion };
export const ausenciasDelCiclo = (estados: EstadoPorSesion[]): EstadoPorSesion[] => estados.filter(fila => fila.estado === "ausente");
export function faltasDelCiclo(estados: EstadoPorSesion[], justificaciones: { catequizandoId: string; fecha: string }[] = [], sumaFalta: (sesion: Sesion) => boolean = sesion => sesion.tipoActividad === "jornada"): Falta[] {
  const agrupados = new Map<string, EstadoPorSesion[]>();
  for (const fila of estados) {
    const clave = `${fila.catequizandoId}:${fila.sesion.fecha}`;
    agrupados.set(clave, [...(agrupados.get(clave) ?? []), fila]);
  }
  const faltas: Falta[] = [];
  for (const filas of agrupados.values()) {
    const { catequizandoId, sesion } = filas[0];
    const justificada = justificaciones.some(justificacion => justificacion.catequizandoId === catequizandoId && justificacion.fecha === sesion.fecha);
    const misa = filas.find(fila => fila.sesion.tipo === "misa");
    const catequesis = filas.find(fila => fila.sesion.tipo === "catequesis");
    if (misa?.estado === "ausente" && catequesis?.estado === "ausente") faltas.push({ catequizandoId, fecha: sesion.fecha, origen: "domingo", sesionIds: [misa.sesion.id, catequesis.sesion.id], justificada });
    for (const fila of filas) if (fila.sesion.tipo === "actividad" && fila.estado === "ausente" && sumaFalta(fila.sesion)) faltas.push({ catequizandoId, fecha: fila.sesion.fecha, origen: "jornada", sesionIds: [fila.sesion.id], justificada });
  }
  return faltas;
}
