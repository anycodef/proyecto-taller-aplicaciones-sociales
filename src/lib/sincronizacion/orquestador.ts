export const esperaReintento = (intentos: number): number => Math.min(300000, 1000 * 2 ** Math.max(0, intentos));
export function debeSincronizar(evento: "reconexion" | "primer_plano" | "lista_confirmada" | "escaneo", estado: { conConexion: boolean; enCurso: boolean; sesionVigente: boolean }): boolean {
  return ["reconexion", "primer_plano", "lista_confirmada", "escaneo"].includes(evento) && estado.conConexion && !estado.enCurso && estado.sesionVigente;
}
