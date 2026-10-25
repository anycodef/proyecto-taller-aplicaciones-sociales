import type { EjecutorHerramientaLectura } from "./servidor.js";

type ConfiguracionGraphql = {
  url?: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
};

type RespuestaGraphql = {
  data?: Record<string, unknown>;
  errors?: { message?: string }[];
};

const consultas = {
  listar_riesgo_grupo: `query ListarRiesgo($grupoId: ID!, $nivelMinimo: NivelRiesgo!) {
    riesgoDelGrupo(grupoId: $grupoId, nivelMinimo: $nivelMinimo) {
      catequizandoId nivel motivo calculadoEn
    }
  }`,
  resumen_asistencia_domingo: `query ResumenDomingo($grupoId: ID!, $fecha: FechaCivil!) {
    asistenciaDelDomingo(grupoId: $grupoId, fecha: $fecha) {
      fecha presentes ausentes justificadas tardanzas
    }
  }`,
} as const;

function consultaCatequizando(incluirAsistencias: boolean): string {
  const asistencias = incluirAsistencias
    ? "asistencias { id fecha estado registradoPor }"
    : "";
  return `query ConsultarCatequizando($catequizandoId: ID!) {
    catequizando(id: $catequizandoId) {
      id identidadOperativa edad grupo { id nombre }
      riesgo { catequizandoId nivel motivo calculadoEn }
      ${asistencias}
    }
  }`;
}

export function crearEjecutorGraphql(configuracion: ConfiguracionGraphql = {}): EjecutorHerramientaLectura {
  const url = configuracion.url ?? "http://localhost:4000/graphql";
  const token = configuracion.token ?? process.env.SIGECAT_TOKEN;
  const hacerFetch = configuracion.fetch ?? globalThis.fetch;

  if (!token) {
    throw new Error("Falta SIGECAT_TOKEN");
  }

  return async (nombre, entrada) => {
    const query = nombre === "consultar_catequizando"
      ? consultaCatequizando(entrada.incluirAsistencias === true)
      : consultas[nombre];
    const variables = { ...entrada };
    delete variables.incluirAsistencias;

    const respuesta = await hacerFetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const cuerpo = await respuesta.json() as RespuestaGraphql;
    if (!respuesta.ok || cuerpo.errors?.length) {
      throw new Error("GraphQL no pudo completar la consulta");
    }

    if (nombre === "listar_riesgo_grupo") return cuerpo.data?.riesgoDelGrupo;
    if (nombre === "consultar_catequizando") return cuerpo.data?.catequizando;
    return cuerpo.data?.asistenciaDelDomingo;
  };
}
