export function clasificarRegistroEntrante(entrada: { cicloIdRegistro: string; cicloAbiertoId: string | null; yaExiste: boolean; sinCambios: boolean }): "aplicar" | "ya_aplicado" | "descartar_ciclo_cerrado" {
  if (entrada.yaExiste && entrada.sinCambios) return "ya_aplicado";
  return entrada.cicloIdRegistro === entrada.cicloAbiertoId ? "aplicar" : "descartar_ciclo_cerrado";
}
export const debePurgarseLocalmente = (cicloId: string, abiertoId: string | null): boolean => cicloId !== abiertoId;
