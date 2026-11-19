import { LIMITE_BYTES } from "./evidencia";

export const MAXIMO_INTENTOS = 5;

/** Primero baja la calidad, que conserva la legibilidad del comprobante, y luego el tamaño. */
const PASOS: readonly { ladoMayor: number; calidad: number }[] = [
  { ladoMayor: 1600, calidad: 0.7 },
  { ladoMayor: 1600, calidad: 0.55 },
  { ladoMayor: 1600, calidad: 0.4 },
  { ladoMayor: 1280, calidad: 0.4 },
  { ladoMayor: 1024, calidad: 0.4 },
];

export type IntentoCompresion = {
  numero: number;
  calidad: number;
  ancho: number;
  alto: number;
  anchoOriginal: number;
  altoOriginal: number;
};
export type ResultadoIntento = { tipo: "listo" } | { tipo: "reintentar"; intento: IntentoCompresion } | { tipo: "fallido" };

function intento(numero: number, anchoOriginal: number, altoOriginal: number): IntentoCompresion {
  const paso = PASOS[numero - 1];
  const escala = Math.min(1, paso.ladoMayor / Math.max(anchoOriginal, altoOriginal));
  return {
    numero,
    calidad: paso.calidad,
    ancho: Math.max(1, Math.round(anchoOriginal * escala)),
    alto: Math.max(1, Math.round(altoOriginal * escala)),
    anchoOriginal,
    altoOriginal,
  };
}

/** Nunca amplía: una foto menor al lado máximo conserva su tamaño. */
export function planInicial(ancho: number, alto: number): IntentoCompresion {
  if (!(ancho > 0 && alto > 0)) throw new RangeError("dimensiones_invalidas");
  return intento(1, ancho, alto);
}

export function siguienteIntento(actual: IntentoCompresion, bytesObtenidos: number): ResultadoIntento {
  if (bytesObtenidos <= LIMITE_BYTES) return { tipo: "listo" };
  if (actual.numero >= MAXIMO_INTENTOS) return { tipo: "fallido" };
  return { tipo: "reintentar", intento: intento(actual.numero + 1, actual.anchoOriginal, actual.altoOriginal) };
}
