import type { NinoNomina } from "./tipos";
export function interpretarCodigoQr(texto: string): { catequizandoId: string; emision: number } | null {
  if (!texto.startsWith("SGC1:")) return null;
  const coincidencia = /^SGC1:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([1-9]\d*)$/i.exec(texto);
  if (!coincidencia || coincidencia[0] !== texto || !Number.isSafeInteger(Number(coincidencia[2])) || Number(coincidencia[2]) > 2147483647) return null;
  return { catequizandoId: coincidencia[1].toLowerCase(), emision: Number(coincidencia[2]) };
}
export function resolverCarne(codigo: string, nomina: NinoNomina[]): { estado: "valido" | "inactivo" | "desconocido"; nino?: NinoNomina } {
  if (!interpretarCodigoQr(codigo)) return { estado: "desconocido" };
  const nino = nomina.find(fila => fila.codigoCarne === codigo);
  return nino ? { estado: nino.activo ? "valido" : "inactivo", nino } : { estado: "desconocido" };
}
