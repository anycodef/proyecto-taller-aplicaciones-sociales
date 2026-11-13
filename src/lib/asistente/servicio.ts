import { recuperarFragmentos } from "./bm25";
import type { CacheRespuestas } from "./cache";
import { evaluarGuardia } from "./guardia";
import { crearPregunta } from "./normalizar";
import { ProveedorExtractivo } from "./proveedor";
import { fuentesUsadas, validarRespuesta } from "./validar";
import type { Corpus, ProveedorRespuesta, RespuestaAsistente, SalidaProveedor } from "./tipos";

export const RESPUESTA_ABSTENCION =
  "No encontré sustento suficiente en el material público para responder esa pregunta. Puedes consultar a la coordinación parroquial.";

export type OpcionesConsulta = {
  corpus: Corpus;
  proveedor?: ProveedorRespuesta;
  proveedorRespaldo?: ProveedorRespuesta;
  cache?: CacheRespuestas;
  limite?: number;
  umbral?: number;
};

function abstencion(versionCorpus: string): RespuestaAsistente {
  return {
    respuesta: RESPUESTA_ABSTENCION,
    fuentes: [],
    proveedor: "extractivo",
    modelo: "abstencion",
    versionCorpus,
  };
}

export async function consultarAsistente(
  pregunta: string,
  opciones: OpcionesConsulta,
): Promise<RespuestaAsistente> {
  const versionCorpus = opciones.corpus.version;
  const guardia = evaluarGuardia(pregunta);
  if (!guardia.permitida) {
    return {
      respuesta: guardia.mensaje,
      fuentes: [],
      proveedor: "guardia",
      modelo: "filtro",
      versionCorpus,
    };
  }

  const consulta = crearPregunta(pregunta);
  const contextoCache = `${opciones.limite ?? ""}|${opciones.umbral ?? ""}`;
  const cacheada = opciones.cache?.obtener(versionCorpus, consulta.normalizada, contextoCache);
  if (cacheada) return cacheada;

  const recuperacion = recuperarFragmentos(opciones.corpus, consulta, {
    limite: opciones.limite,
    umbral: opciones.umbral,
  });
  if (recuperacion.fragmentos.length === 0) return abstencion(versionCorpus);

  const entrada = { pregunta: consulta, fragmentos: recuperacion.fragmentos };
  let salida: SalidaProveedor;
  try {
    salida = await (opciones.proveedor ?? new ProveedorExtractivo()).generar(entrada);
  } catch {
    try {
      salida = await (opciones.proveedorRespaldo ?? new ProveedorExtractivo()).generar(entrada);
    } catch {
      return abstencion(versionCorpus);
    }
  }

  if (!validarRespuesta(salida.texto, recuperacion.fragmentos).valida) return abstencion(versionCorpus);
  const fuentes = fuentesUsadas(salida.texto, recuperacion.fragmentos);
  if (fuentes.length === 0) return abstencion(versionCorpus);

  const resultado: RespuestaAsistente = {
    respuesta: salida.texto,
    fuentes,
    proveedor: salida.proveedor,
    modelo: salida.modelo,
    versionCorpus,
  };
  opciones.cache?.guardar(versionCorpus, consulta.normalizada, resultado, contextoCache);
  return resultado;
}
