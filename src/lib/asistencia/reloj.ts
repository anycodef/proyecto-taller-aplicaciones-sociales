export function estimarDesfase(horaServidor: number, enviadoEn: number, recibidoEn: number): number {
  if (![horaServidor, enviadoEn, recibidoEn].every(Number.isFinite) || recibidoEn < enviadoEn) throw new Error("Reloj inválido");
  return horaServidor - (enviadoEn + recibidoEn) / 2;
}
export function horaEfectiva(horaDispositivo: string, desfaseMs: number): number {
  const hora = Date.parse(horaDispositivo);
  if (!Number.isFinite(hora) || !Number.isSafeInteger(desfaseMs) || Math.abs(desfaseMs) > 86400000) throw new Error("Reloj inválido");
  return hora + desfaseMs;
}
export function dentroDeVentana(hora: number, ventana: { inicio: number; fin: number }, toleranciaMin = 10): boolean {
  return Number.isFinite(hora) && hora >= ventana.inicio - toleranciaMin * 60000 && hora <= ventana.fin + toleranciaMin * 60000;
}
export function compararInstantes(a: string, b: string): number {
  const diferencia = Date.parse(a) - Date.parse(b);
  if (!Number.isFinite(diferencia)) throw new Error("Instante inválido");
  if (diferencia) return diferencia;
  // PostgreSQL conserva microsegundos; Date solo conserva milisegundos.
  const fraccion = (instante: string): string => (/\.(\d+)/.exec(instante)?.[1] ?? "").padEnd(9, "0").slice(0, 9);
  return fraccion(a).localeCompare(fraccion(b));
}
