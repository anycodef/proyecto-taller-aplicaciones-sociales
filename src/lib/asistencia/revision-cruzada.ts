export function detectarMisaSinCatequesis(misa: { catequizandoId: string; valor: string }[], catequesis: { catequizandoId: string; valor: string }[], listaConfirmada: boolean): string[] {
  if (!listaConfirmada) return [];
  return misa.filter(fila => fila.valor === "presente" && catequesis.some(otra => otra.catequizandoId === fila.catequizandoId && otra.valor === "ausente")).map(fila => fila.catequizandoId);
}
