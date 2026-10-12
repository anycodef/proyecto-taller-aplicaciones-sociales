import { v5 } from "uuid";
import { PARAMETROS_PREDETERMINADOS, type ParametrosAsistencia, type Sesion, type TipoSesion } from "./tipos";

// Namespace estable: cambiarlo rompería los ids de sesiones creadas sin conexión.
export const NAMESPACE_ASISTENCIA = "76f89404-ced2-5a87-bdf1-076e5e670b13";
export function idSesion(cicloId: string, fecha: string, tipo: TipoSesion, actividadId?: string | null): string {
  return v5(JSON.stringify(["sesion", cicloId, fecha, tipo, actividadId ?? null]), NAMESPACE_ASISTENCIA);
}
export const idAsistencia = (sesionId: string, catequizandoId: string): string =>
  v5(JSON.stringify(["asistencia", sesionId, catequizandoId]), NAMESPACE_ASISTENCIA);
export const idAviso = (tipo: string, sesionId: string, referencia: string): string =>
  v5(JSON.stringify(["aviso", tipo, sesionId, referencia]), NAMESPACE_ASISTENCIA);
export function fechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && Number.isFinite(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha;
}
export function domingosDelCiclo(inicio: string, fin: string): string[] {
  if (!fechaValida(inicio) || !fechaValida(fin) || inicio > fin) throw new Error("Fechas del ciclo inválidas");
  const domingos: string[] = [];
  for (let dia = Date.parse(inicio); dia <= Date.parse(fin); dia += 86400000) {
    if (new Date(dia).getUTCDay() === 0) domingos.push(new Date(dia).toISOString().slice(0, 10));
  }
  return domingos;
}
export function instanteLima(fecha: string, hora: string): number {
  if (!fechaValida(fecha) || ![5, 8].includes(hora.length) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)) throw new Error("Fecha u hora inválida");
  return Date.parse(`${fecha}T${hora.length === 5 ? `${hora}:00` : hora}-05:00`);
}
export function ventanaDe(sesion: Sesion, parametros = PARAMETROS_PREDETERMINADOS): { inicio: number; fin: number } {
  const inicio = sesion.ventanaInicio ?? (sesion.tipo === "misa" ? parametros.ventanaMisaInicio : sesion.tipo === "catequesis" ? "09:50:00" : "00:00:00");
  const fin = sesion.ventanaFin ?? (sesion.tipo === "misa" ? parametros.ventanaMisaFin : sesion.tipo === "catequesis" ? parametros.horaFinDomingo : "23:59:59");
  return { inicio: instanteLima(sesion.fecha, inicio), fin: instanteLima(sesion.fecha, fin) };
}
export const finDelDomingo = (fecha: string, parametros: ParametrosAsistencia = PARAMETROS_PREDETERMINADOS): number => instanteLima(fecha, parametros.horaFinDomingo);
export const sesionEnCurso = (sesiones: Sesion[], ahora: number): Sesion | undefined => sesiones.find(sesion => {
  const ventana = ventanaDe(sesion);
  return !sesion.cancelada && ahora >= ventana.inicio && ahora <= ventana.fin;
});
