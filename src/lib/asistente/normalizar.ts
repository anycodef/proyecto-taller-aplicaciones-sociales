import type { Pregunta } from "./tipos";

const PALABRAS_VACIAS = new Set([
  "a",
  "al",
  "algo",
  "como",
  "con",
  "cual",
  "cuando",
  "de",
  "del",
  "dime",
  "donde",
  "el",
  "ella",
  "en",
  "es",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "explica",
  "explicame",
  "favor",
  "fue",
  "ha",
  "hablame",
  "la",
  "las",
  "le",
  "lo",
  "los",
  "mas",
  "me",
  "mi",
  "mis",
  "muy",
  "no",
  "nos",
  "o",
  "para",
  "pero",
  "por",
  "porque",
  "puedes",
  "que",
  "quien",
  "quiero",
  "se",
  "segun",
  "sin",
  "sobre",
  "su",
  "sus",
  "te",
  "tu",
  "tus",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "y",
  "ya",
]);

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenizar(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/\s+/)
    .filter((termino) => termino.length > 1 && !PALABRAS_VACIAS.has(termino));
}

export function crearPregunta(texto: string): Pregunta {
  return {
    original: texto.trim(),
    normalizada: normalizarTexto(texto),
    terminos: [...new Set(tokenizar(texto))],
  };
}
