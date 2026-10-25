import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";

import {
  esNombreHerramientaLectura,
  esquemasHerramientasLectura,
  herramientasLectura,
  type NombreHerramientaLectura,
} from "./herramientas-lectura.js";

export type EjecutorHerramientaLectura = (
  nombre: NombreHerramientaLectura,
  entrada: Record<string, unknown>,
) => Promise<unknown>;

export function crearServidorMcp(ejecutar: EjecutorHerramientaLectura): Server {
  const servidor = new Server(
    { name: "sigecat", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  servidor.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: herramientasLectura,
  }));

  servidor.setRequestHandler(CallToolRequestSchema, async (solicitud) => {
    const { name: nombre, arguments: argumentos = {} } = solicitud.params;
    if (!esNombreHerramientaLectura(nombre)) {
      throw new McpError(ErrorCode.MethodNotFound, `Herramienta desconocida: ${nombre}`);
    }

    try {
      const entrada = esquemasHerramientasLectura[nombre].parse(argumentos);
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
  ejecutar: EjecutorHerramientaLectura,
): Promise<Server> {
  const servidor = crearServidorMcp(ejecutar);
  await servidor.connect(new StdioServerTransport());
  return servidor;
}
