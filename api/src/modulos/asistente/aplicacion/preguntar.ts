import {
  cargarCorpus,
  consultarAsistente,
  type ProveedorRespuesta,
  type RespuestaAsistente,
} from "@/lib/asistente";
import { CORPUS_ASISTENTE } from "../corpus/fragmentos";

export const corpusAsistente = cargarCorpus(CORPUS_ASISTENTE);

export type OpcionesPreguntar = {
  proveedor?: ProveedorRespuesta;
  proveedorRespaldo?: ProveedorRespuesta;
};

export function preguntarAsistente(
  pregunta: string,
  opciones: OpcionesPreguntar = {},
): Promise<RespuestaAsistente> {
  return consultarAsistente(pregunta, { corpus: corpusAsistente, ...opciones });
}
