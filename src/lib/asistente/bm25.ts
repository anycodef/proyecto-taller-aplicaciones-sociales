import { tokenizar } from "./normalizar";
import type { Corpus, Fragmento, Pregunta, ResultadoRecuperacion } from "./tipos";

const K1 = 1.2;
const B = 0.75;
export const UMBRAL_PREDETERMINADO = 0.1;
export const LIMITE_PREDETERMINADO = 5;

type DocumentoIndexado = {
  fragmento: Fragmento;
  frecuencias: Map<string, number>;
  longitud: number;
  orden: number;
};

type Indice = {
  documentos: DocumentoIndexado[];
  frecuenciaDocumental: Map<string, number>;
  longitudMedia: number;
};

function indexar(corpus: Corpus): Indice {
  const frecuenciaDocumental = new Map<string, number>();
  const documentos = corpus.fragmentos.map((fragmento, orden) => {
    const terminos = tokenizar(`${fragmento.documento} ${fragmento.seccion} ${fragmento.texto}`);
    const frecuencias = new Map<string, number>();
    for (const termino of terminos) frecuencias.set(termino, (frecuencias.get(termino) ?? 0) + 1);
    for (const termino of frecuencias.keys()) {
      frecuenciaDocumental.set(termino, (frecuenciaDocumental.get(termino) ?? 0) + 1);
    }
    return { fragmento, frecuencias, longitud: terminos.length, orden };
  });

  const totalTerminos = documentos.reduce((total, documento) => total + documento.longitud, 0);
  return {
    documentos,
    frecuenciaDocumental,
    longitudMedia: documentos.length > 0 ? totalTerminos / documentos.length : 1,
  };
}

function idf(totalDocumentos: number, frecuencia: number): number {
  return Math.log(1 + (totalDocumentos - frecuencia + 0.5) / (frecuencia + 0.5));
}

export function recuperarFragmentos(
  corpus: Corpus,
  pregunta: Pregunta,
  opciones: { limite?: number; umbral?: number } = {},
): ResultadoRecuperacion {
  if (pregunta.terminos.length === 0 || corpus.fragmentos.length === 0) {
    return { fragmentos: [], puntajes: [] };
  }

  const indice = indexar(corpus);
  const limite = opciones.limite ?? LIMITE_PREDETERMINADO;
  const umbral = opciones.umbral ?? UMBRAL_PREDETERMINADO;
  const total = indice.documentos.length;
  const longitudMedia = indice.longitudMedia || 1;

  const puntuados = indice.documentos
    .map((documento) => {
      let puntaje = 0;
      for (const termino of pregunta.terminos) {
        const frecuencia = documento.frecuencias.get(termino) ?? 0;
        if (frecuencia === 0) continue;
        const df = indice.frecuenciaDocumental.get(termino) ?? 0;
        const normalizacion = frecuencia + K1 * (1 - B + (B * documento.longitud) / longitudMedia);
        puntaje += idf(total, df) * ((frecuencia * (K1 + 1)) / normalizacion);
      }
      return { documento, puntaje };
    })
    .filter(({ puntaje }) => puntaje >= umbral)
    .sort((a, b) => b.puntaje - a.puntaje || a.documento.orden - b.documento.orden)
    .slice(0, limite);

  return {
    fragmentos: puntuados.map(({ documento }) => documento.fragmento),
    puntajes: puntuados.map(({ puntaje }) => puntaje),
  };
}
