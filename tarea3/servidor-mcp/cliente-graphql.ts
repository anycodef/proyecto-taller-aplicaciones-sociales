import type { EjecutorHerramienta } from "./servidor.js";

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

const mutaciones = {
  registrar_asistencia: `mutation RegistrarAsistencia($entrada: RegistrarAsistenciaEntrada!) {
    registrarAsistencia(entrada: $entrada) { id repetido }
  }`,
  registrar_justificacion: `mutation RegistrarJustificacion($entrada: RegistrarJustificacionEntrada!) {
    registrarJustificacion(entrada: $entrada) { id repetido }
  }`,
  recalcular_riesgo: `mutation RecalcularRiesgo($catequizandoId: ID!) {
    recalcularRiesgo(catequizandoId: $catequizandoId) {
      catequizandoId nivel motivo calculadoEn
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

export function crearEjecutorGraphql(configuracion: ConfiguracionGraphql = {}): EjecutorHerramienta {
  const url = configuracion.url ?? "http://localhost:4000/graphql";
  const token = configuracion.token ?? process.env.SIGECAT_TOKEN;
  const hacerFetch = configuracion.fetch ?? globalThis.fetch;

  if (!token) {
    throw new Error("Falta SIGECAT_TOKEN");
  }

  return async (nombre, entrada) => {
    const esEscritura = nombre in mutaciones;
    const query = nombre === "consultar_catequizando"
      ? consultaCatequizando(entrada.incluirAsistencias === true)
      : esEscritura
        ? mutaciones[nombre as keyof typeof mutaciones]
        : consultas[nombre as keyof typeof consultas];
    const variables = nombre === "registrar_asistencia" || nombre === "registrar_justificacion"
      ? { entrada }
      : { ...entrada };
    delete (variables as Record<string, unknown>).incluirAsistencias;

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
    if (nombre === "resumen_asistencia_domingo") return cuerpo.data?.asistenciaDelDomingo;
    if (nombre === "registrar_asistencia") return cuerpo.data?.registrarAsistencia;
    if (nombre === "registrar_justificacion") return cuerpo.data?.registrarJustificacion;
    return cuerpo.data?.recalcularRiesgo;
  };
}
