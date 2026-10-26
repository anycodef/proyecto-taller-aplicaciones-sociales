import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type HerramientaEscritura = Tool & {
  annotations: {
    destructiveHint: false;
    idempotentHint: true;
  };
};

export const esquemaRegistrarAsistencia = z.object({
  catequizandoId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estado: z.enum(["PRESENTE", "AUSENTE", "JUSTIFICADA", "TARDANZA"]),
});

export const esquemaRegistrarJustificacion = z.object({
  asistenciaId: z.string().uuid(),
  motivo: z.string().trim().min(1).max(500),
});

export const esquemaRecalcularRiesgo = z.object({
  catequizandoId: z.string().uuid(),
});

export const herramientasEscritura: HerramientaEscritura[] = [
  {
    name: "registrar_asistencia",
    description: "Registra una asistencia con un UUID generado por el servidor MCP.",
    inputSchema: {
      type: "object",
      properties: {
        catequizandoId: { type: "string", format: "uuid" },
        fecha: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        estado: {
          type: "string",
          enum: ["PRESENTE", "AUSENTE", "JUSTIFICADA", "TARDANZA"],
        },
      },
      required: ["catequizandoId", "fecha", "estado"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  },
  {
    name: "registrar_justificacion",
    description: "Registra una justificación con un UUID generado por el servidor MCP.",
    inputSchema: {
      type: "object",
      properties: {
        asistenciaId: { type: "string", format: "uuid" },
        motivo: { type: "string", minLength: 1, maxLength: 500 },
      },
      required: ["asistenciaId", "motivo"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  },
  {
    name: "recalcular_riesgo",
    description: "Recalcula y persiste el riesgo actual de un catequizando.",
    inputSchema: {
      type: "object",
      properties: {
        catequizandoId: { type: "string", format: "uuid" },
      },
      required: ["catequizandoId"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  },
];

export const esquemasHerramientasEscritura = {
  registrar_asistencia: esquemaRegistrarAsistencia,
  registrar_justificacion: esquemaRegistrarJustificacion,
  recalcular_riesgo: esquemaRecalcularRiesgo,
} as const;

export type NombreHerramientaEscritura = keyof typeof esquemasHerramientasEscritura;

export function esNombreHerramientaEscritura(nombre: string): nombre is NombreHerramientaEscritura {
  return Object.hasOwn(esquemasHerramientasEscritura, nombre);
}
