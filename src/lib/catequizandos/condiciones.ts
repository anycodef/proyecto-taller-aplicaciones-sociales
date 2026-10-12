export const CATEGORIAS_CONDICION = ["trastorno_espectro_autista", "deficit_atencion_hiperactividad", "discapacidad_fisica", "discapacidad_intelectual", "alergia", "condicion_medica", "otra"] as const;
export const LARGO_MAXIMO_NOTA = 200;
export function validarCondiciones(lista: { categoria: string; nota?: string }[]): boolean {
  return new Set(lista.map(c => c.categoria)).size === lista.length && lista.every(c => CATEGORIAS_CONDICION.some(v => v === c.categoria) && (c.nota === undefined || [...c.nota].length <= LARGO_MAXIMO_NOTA));
}
