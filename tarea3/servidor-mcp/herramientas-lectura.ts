import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type HerramientaConAnotaciones = Tool & {
  annotations: {
    readOnlyHint: true;
  };
};

export const esquemaListarRiesgoGrupo = z.object({
  grupoId: z.string().uuid(),
  nivelMinimo: z.enum(["BAJO", "MEDIO", "ALTO"]).default("MEDIO"),
});

export const esquemaConsultarCatequizando = z.object({
  catequizandoId: z.string().uuid(),
  incluirAsistencias: z.boolean().default(false),
});

export const esquemaResumenAsistenciaDomingo = z.object({
  grupoId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const herramientas: HerramientaConAnotaciones[] = [
  {
    name: "listar_riesgo_grupo",
    description: "Lista los catequizandos con riesgo de un grupo desde el nivel indicado.",
    inputSchema: {
      type: "object",
      properties: {
        grupoId: { type: "string", format: "uuid" },
        nivelMinimo: {
          type: "string",
          enum: ["BAJO", "MEDIO", "ALTO"],
          default: "MEDIO",
        },
      },
      required: ["grupoId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "consultar_catequizando",
    description: "Consulta la ficha operativa de un catequizando y opcionalmente sus asistencias.",
    inputSchema: {
      type: "object",
      properties: {
        catequizandoId: { type: "string", format: "uuid" },
        incluirAsistencias: { type: "boolean", default: false },
      },
      required: ["catequizandoId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "resumen_asistencia_domingo",
    description: "Resume la asistencia de un grupo en un domingo concreto.",
    inputSchema: {
      type: "object",
      properties: {
        grupoId: { type: "string", format: "uuid" },
        fecha: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      },
      required: ["grupoId", "fecha"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

export const herramientasLectura = herramientas;

export const esquemasHerramientasLectura = {
  listar_riesgo_grupo: esquemaListarRiesgoGrupo,
  consultar_catequizando: esquemaConsultarCatequizando,
  resumen_asistencia_domingo: esquemaResumenAsistenciaDomingo,
} as const;

export type NombreHerramientaLectura = keyof typeof esquemasHerramientasLectura;

export function esNombreHerramientaLectura(nombre: string): nombre is NombreHerramientaLectura {
  return Object.hasOwn(esquemasHerramientasLectura, nombre);
}
