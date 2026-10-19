/**
 * Peru no cambia de hora: siempre UTC-5. Las fechas de la app se envian como
 * ISO con ese desfase para que el servidor y el celular coincidan.
 */
export const DESFAJE_LIMA = "-05:00";

const HORA_LIMA = 5 * 60 * 60 * 1000;

/** Fecha de hoy en Lima, en formato YYYY-MM-DD. */
export function hoyEnLima(ahora: Date = new Date()): string {
  const desplazado = new Date(ahora.getTime() - HORA_LIMA);
  return desplazado.toISOString().slice(0, 10);
}

/** Inicio del dia en Lima, como instante ISO con el desfase de Peru. */
export function inicioDelDiaEnLima(fecha: string): string {
  return `${fecha}T00:00:00${DESFAJE_LIMA}`;
}

/** Fin del dia en Lima, como instante ISO con el desfase de Peru. */
export function finDelDiaEnLima(fecha: string): string {
  return `${fecha}T23:59:59${DESFAJE_LIMA}`;
}

/** Si la fecha tiene forma YYYY-MM-DD y existe. */
export function esFechaCivil(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`));
}
