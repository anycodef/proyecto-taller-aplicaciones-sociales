import { ErrorDeValidacion } from "./errores";

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Interpreta `YYYY-MM-DD` como fecha de calendario; rechaza formatos y días inexistentes. */
export function parsearFecha(valor: string, campo: string): { anio: number; mes: number; dia: number } {
  const m = FECHA.exec(valor);
  if (!m) throw new ErrorDeValidacion(`${campo} debe tener el formato YYYY-MM-DD`);
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new ErrorDeValidacion(`${campo} no es una fecha válida`);
  }
  return { anio, mes, dia };
}

/** Años cumplidos de `fechaNacimiento` (YYYY-MM-DD) a la fecha `ahora`, en UTC. */
export function calcularEdad(fechaNacimiento: string, ahora: Date): number {
  const { anio, mes, dia } = parsearFecha(fechaNacimiento, "fechaNacimiento");
  let edad = ahora.getUTCFullYear() - anio;
  const mesActual = ahora.getUTCMonth() + 1;
  const yaCumplio = mesActual > mes || (mesActual === mes && ahora.getUTCDate() >= dia);
  if (!yaCumplio) edad -= 1;
  return edad;
}
