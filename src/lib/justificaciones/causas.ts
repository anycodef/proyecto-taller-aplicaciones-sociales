import type { Causa } from "./tipos";

/** Lista cerrada de la ficha de compromiso; viajes o fiestas no justifican. */
export const CAUSAS: readonly Causa[] = ["salud_nino", "familiar_directo", "evento_escolar"];

/** El parentesco no se valida: la coordinación lo juzga al revisar (supuesto A-02). */
export const ETIQUETAS_CAUSA: Record<Causa, string> = {
  salud_nino: "Salud del niño",
  familiar_directo: "Enfermedad o fallecimiento de un familiar directo",
  evento_escolar: "Evento escolar comunicado con anticipación",
};

export function esCausaValida(causa: string): causa is Causa {
  return (CAUSAS as readonly string[]).includes(causa);
}

/** Solo el evento escolar se conoce antes de la fecha (supuesto A-03). */
export function permiteAnticipada(causa: Causa): boolean {
  return causa === "evento_escolar";
}
