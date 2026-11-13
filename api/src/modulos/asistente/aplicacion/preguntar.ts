import {
  CacheRespuestas,
  cargarCorpus,
  consultarAsistente,
  ProveedorExtractivo,
  type ProveedorRespuesta,
  type RespuestaAsistente,
} from "@/lib/asistente";
import { CORPUS_ASISTENTE } from "../corpus/fragmentos";
import { crearProveedorAsistente } from "./proveedores";

export const corpusAsistente = cargarCorpus(CORPUS_ASISTENTE);

const cacheAsistente = new CacheRespuestas();

export type OpcionesPreguntar = {
  proveedor?: ProveedorRespuesta;
  proveedorRespaldo?: ProveedorRespuesta;
  cache?: CacheRespuestas;
};

export function preguntarAsistente(
  pregunta: string,
  opciones: OpcionesPreguntar = {},
): Promise<RespuestaAsistente> {
  const proveedor = opciones.proveedor ?? crearProveedorAsistente();
  const proveedorRespaldo = opciones.proveedorRespaldo ?? new ProveedorExtractivo();
  const cache = opciones.cache ?? (opciones.proveedor ? undefined : cacheAsistente);
  return consultarAsistente(pregunta, { corpus: corpusAsistente, proveedor, proveedorRespaldo, cache });
}
