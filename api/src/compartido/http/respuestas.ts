import type { HttpResponseInit } from "@azure/functions";

export class ErrorAplicacion extends Error {
  constructor(public readonly estado: number, public readonly codigo: string) { super(codigo); }
}
export function respuesta(jsonBody: unknown, status = 200): HttpResponseInit {
  return { status, jsonBody, headers: { "Cache-Control": "no-store" } };
}
export const noAutorizado = () => respuesta({ codigo: "acceso_denegado" }, 401);
export const fueraDeAlcance = () => respuesta({ codigo: "fuera_de_alcance" }, 403);
export const entradaInvalida = () => respuesta({ codigo: "entrada_invalida" }, 422);
