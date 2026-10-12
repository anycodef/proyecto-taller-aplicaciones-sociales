export function esFechaCivil(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}
export function edadEnFecha(nacimiento: string, fecha: string): number {
  if (!esFechaCivil(nacimiento) || !esFechaCivil(fecha) || nacimiento > fecha) throw new Error("fecha_invalida");
  return Number(fecha.slice(0, 4)) - Number(nacimiento.slice(0, 4)) - (fecha.slice(5) < nacimiento.slice(5) ? 1 : 0);
}
export const edadAlInicioDelCiclo = edadEnFecha;
export const estaEnRangoCatequesis = (edad: number): boolean => Number.isInteger(edad) && edad >= 8 && edad <= 13;
