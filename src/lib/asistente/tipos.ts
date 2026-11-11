export type Fragmento = {
  id: string;
  documento: string;
  seccion: string;
  texto: string;
  fuente: string;
  licencia: string;
  version: string;
};

export type Corpus = {
  version: string;
  fragmentos: Fragmento[];
};

export type Pregunta = {
  original: string;
  normalizada: string;
  terminos: string[];
};

export type Fuente = Pick<Fragmento, "id" | "documento" | "seccion" | "fuente" | "licencia">;

export type ResultadoRecuperacion = {
  fragmentos: Fragmento[];
  puntajes: number[];
};

export type RespuestaAsistente = {
  respuesta: string;
  fuentes: Fuente[];
  proveedor: string;
  modelo: string;
  versionCorpus: string;
};

export type MotivoRechazo = "datos_personales" | "consejo_profesional";

export type EvaluacionGuardia =
  | { permitida: true }
  | { permitida: false; motivo: MotivoRechazo; mensaje: string };

export type EntradaProveedor = {
  pregunta: Pregunta;
  fragmentos: Fragmento[];
};

export type SalidaProveedor = {
  texto: string;
  proveedor: string;
  modelo: string;
};

export interface ProveedorRespuesta {
  generar(entrada: EntradaProveedor): Promise<SalidaProveedor>;
}

export type ResultadoValidacion =
  | { valida: true }
  | { valida: false; motivo: "sin_citas" | "cita_inventada" | "dato_personal" | "autoridad_doctrinal" };
