const formato = /^SGC1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([1-9][0-9]*)$/i;
export function interpretarCodigoCarne(texto: string): { catequizandoId: string; emision: number } | { invalido: true } {
  const partes = formato.exec(texto);
  if (!partes || partes[0] !== texto || !Number.isSafeInteger(Number(partes[2])) || Number(partes[2]) > 2147483647) return { invalido: true };
  return { catequizandoId: partes[1].toLowerCase(), emision: Number(partes[2]) };
}
export function codificarCarne(catequizandoId: string, emision: number): string {
  const codigo = `SGC1:${catequizandoId.toLowerCase()}:${emision}`;
  if ("invalido" in interpretarCodigoCarne(codigo)) throw new Error("carne_invalido");
  return codigo;
}
