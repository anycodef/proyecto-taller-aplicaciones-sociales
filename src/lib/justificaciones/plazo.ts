import { esFechaCivil, finDelDiaEnLima, hoyEnLima } from "@/lib/seguridad/fechas";
import { ErrorJustificacion } from "./tipos";

/** Vale hasta que la coordinación defina el plazo del ciclo (supuesto A-11). */
export const PLAZO_PREDETERMINADO_DIAS = 7;
export const PLAZO_MINIMO_DIAS = 1;
export const PLAZO_MAXIMO_DIAS = 60;

export function validarDiasPlazo(dias: number): void {
  if (!Number.isInteger(dias) || dias < PLAZO_MINIMO_DIAS || dias > PLAZO_MAXIMO_DIAS) throw new ErrorJustificacion("plazo_invalido");
}

function sumarDias(fecha: string, dias: number): string {
  if (!esFechaCivil(fecha)) throw new ErrorJustificacion("fecha_invalida");
  const base = new Date(`${fecha}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Último día civil en que la ausencia aún puede justificarse. */
export function ultimoDiaDelPlazo(fechaAusencia: string, diasPlazo: number): string {
  validarDiasPlazo(diasPlazo);
  return sumarDias(fechaAusencia, diasPlazo);
}

/** El plazo vence al final del día en America/Lima (supuesto A-12). */
export function fechaLimite(fechaAusencia: string, diasPlazo: number): string {
  return finDelDiaEnLima(ultimoDiaDelPlazo(fechaAusencia, diasPlazo));
}

export function plazoVigente(fechaAusencia: string, diasPlazo: number, ahora: Date): boolean {
  return hoyEnLima(ahora) <= ultimoDiaDelPlazo(fechaAusencia, diasPlazo);
}
