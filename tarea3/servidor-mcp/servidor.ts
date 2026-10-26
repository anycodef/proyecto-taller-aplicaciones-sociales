import { randomUUID } from "node:crypto";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";

import {
  esNombreHerramientaLectura,
  esquemasHerramientasLectura,
  herramientasLectura,
  type NombreHerramientaLectura,
} from "./herramientas-lectura.js";
import {
  esNombreHerramientaEscritura,
  esquemasHerramientasEscritura,
  herramientasEscritura,
  type NombreHerramientaEscritura,
} from "./herramientas-escritura.js";

export type NombreHerramienta = NombreHerramientaLectura | NombreHerramientaEscritura;

export type EjecutorHerramienta = (
  nombre: NombreHerramienta,
  entrada: Record<string, unknown>,
) => Promise<unknown>;

export function crearServidorMcp(ejecutar: EjecutorHerramienta): Server {
  const servidor = new Server(
    { name: "sigecat", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  servidor.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [{
      uriTemplate: "sigecat://grupo/{grupoId}/riesgo",
      name: "Riesgo actual del grupo",
      description: "Lista de catequizandos con riesgo MEDIO o ALTO.",
      mimeType: "application/json",
    }],
  }));

  servidor.setRequestHandler(ReadResourceRequestSchema, async (solicitud) => {
    const coincidencia = /^sigecat:\/\/grupo\/([0-9a-f-]{36})\/riesgo$/i.exec(solicitud.params.uri);
    if (!coincidencia) {
      throw new McpError(ErrorCode.InvalidParams, "URI de recurso no válida");
    }
    const resultado = await ejecutar("listar_riesgo_grupo", {
      grupoId: coincidencia[1],
      nivelMinimo: "MEDIO",
    });
    return {
      contents: [{
        uri: solicitud.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(resultado),
      }],
    };
  });

  servidor.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [{
      name: "revision-dominical",
      description: "Revisa asistencia y riesgo después de la jornada dominical.",
      arguments: [{ name: "grupoId", description: "UUID del grupo", required: true }],
    }],
  }));

  servidor.setRequestHandler(GetPromptRequestSchema, async (solicitud) => {
    if (solicitud.params.name !== "revision-dominical") {
      throw new McpError(ErrorCode.MethodNotFound, "Prompt desconocido");
    }
    const grupoId = solicitud.params.arguments?.grupoId;
    if (!grupoId || !/^[0-9a-f-]{36}$/i.test(grupoId)) {
      throw new McpError(ErrorCode.InvalidParams, "grupoId no es válido");
    }
    return {
      description: "Revisión dominical del grupo",
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Revisa la asistencia del último domingo del grupo ${grupoId}, lista a quienes están en riesgo MEDIO o ALTO y propón a quién contactar primero.`,
        },
      }],
    };
  });

  servidor.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...herramientasLectura, ...herramientasEscritura],
  }));

  servidor.setRequestHandler(CallToolRequestSchema, async (solicitud) => {
    const { name: nombre, arguments: argumentos = {} } = solicitud.params;
    if (!esNombreHerramientaLectura(nombre) && !esNombreHerramientaEscritura(nombre)) {
      throw new McpError(ErrorCode.MethodNotFound, `Herramienta desconocida: ${nombre}`);
    }

    try {
      const entradaValidada = esNombreHerramientaLectura(nombre)
        ? esquemasHerramientasLectura[nombre].parse(argumentos)
        : esquemasHerramientasEscritura[nombre].parse(argumentos);
      const entrada = nombre === "registrar_asistencia" || nombre === "registrar_justificacion"
        ? { id: randomUUID(), ...entradaValidada }
        : entradaValidada;
      const resultado = await ejecutar(nombre, entrada);

      return {
        content: [{ type: "text", text: JSON.stringify(resultado) }],
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new McpError(ErrorCode.InvalidParams, "La entrada de la herramienta no es válida");
      }
      throw error;
    }
  });

  return servidor;
}

export async function conectarServidorStdio(
  ejecutar: EjecutorHerramienta,
): Promise<Server> {
  const servidor = crearServidorMcp(ejecutar);
  await servidor.connect(new StdioServerTransport());
  return servidor;
}

