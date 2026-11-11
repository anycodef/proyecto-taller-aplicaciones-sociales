import { app, type HttpResponseInit } from "@azure/functions";
import { obtenerPool } from "../bd/pool";

export async function manejarEstado(): Promise<HttpResponseInit> {
  try {
    const consulta = { text: "SELECT 1", query_timeout: 5000 };
    await obtenerPool().query(consulta);
    return { status: 200, jsonBody: { estado: "disponible" }, headers: { "Cache-Control": "no-store" } };
  } catch {
    return { status: 503, jsonBody: { estado: "no_disponible" }, headers: { "Cache-Control": "no-store" } };
  }
}

let registrado = false;
export function registrarEstado(): void {
  if (registrado) return;
  registrado = true;
  app.http("estado", { methods: ["GET"], authLevel: "function", route: "estado", handler: manejarEstado });
}
