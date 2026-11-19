import type { ClienteHttp } from "@/lib/seguridad/api";

/** Límites del cuerpo de `POST /asistente/preguntar` (esquema estricto del servidor). */
export const PREGUNTA_MINIMO = 3;
export const PREGUNTA_MAXIMO = 500;

/** Comprobadas contra el corpus público: cada una devuelve fuentes. */
export const SUGERENCIAS = ["¿Qué es la confirmación?", "¿Qué es la eucaristía?", "¿Qué es el bautismo?"] as const;

export const NOTA_ASISTENTE = "Respuestas basadas en material público de catequesis. No sustituye a la coordinación ni da consejo médico o legal.";

export const AVISO_PRIVACIDAD_ASISTENTE =
  "No escribas nombres, documentos, datos de salud ni otros datos de niños. El asistente solo necesita tu pregunta.";

export type FuenteAsistenteApi = { id: string; documento: string; seccion: string; fuente: string; licencia: string };

export type RespuestaAsistenteApi = {
  respuesta: string;
  fuentes: FuenteAsistenteApi[];
  proveedor: string;
  modelo: string;
  versionCorpus: string;
};

/** Una pregunta se envía solo con 3 a 500 caracteres útiles; el servidor también lo exige (RNF-1004). */
export function preguntaValida(texto: string): boolean {
  const limpia = texto.trim();
  return limpia.length >= PREGUNTA_MINIMO && limpia.length <= PREGUNTA_MAXIMO;
}

/** Cómo mostrar una respuesta: con fuentes es doctrina citada; sin ellas, el asistente se abstuvo o rechazó. */
export type TipoRespuesta = "citada" | "abstencion" | "rechazo";

export function tipoDeRespuesta(respuesta: RespuestaAsistenteApi): TipoRespuesta {
  if (respuesta.proveedor === "guardia" || respuesta.modelo === "filtro") return "rechazo";
  if (respuesta.modelo === "abstencion" || respuesta.fuentes.length === 0) return "abstencion";
  return "citada";
}

export function crearApiAsistente(cliente: ClienteHttp) {
  return {
    /** El servidor no guarda preguntas ni respuestas (RNF-1001): el cliente tampoco, solo las muestra en pantalla. */
    preguntar: (pregunta: string): Promise<RespuestaAsistenteApi> =>
      cliente.solicitar<RespuestaAsistenteApi>("POST", "/asistente/preguntar", { pregunta: pregunta.trim() }),
  };
}
export type ApiAsistente = ReturnType<typeof crearApiAsistente>;
