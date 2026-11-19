import {
  PROVEEDORES_LLM,
  ProveedorExtractivo,
  ProveedorLLM,
  type NombreProveedorLLM,
  type ProveedorRespuesta,
} from "@/lib/asistente";

export type EntornoAsistente = {
  ASISTENTE_PROVEEDOR?: string;
  ASISTENTE_MODELO?: string;
  ASISTENTE_CLAVE?: string;
  ASISTENTE_URL?: string;
  ASISTENTE_TIMEOUT_MS?: string;
};

const MODELOS_PREDETERMINADOS: Record<NombreProveedorLLM, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3.2:3b",
};

const TIMEOUT_PREDETERMINADO_MS = 8000;

function esProveedorLLM(valor: string): valor is NombreProveedorLLM {
  return (PROVEEDORES_LLM as readonly string[]).includes(valor);
}

function leerTimeout(valor: string | undefined): number {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : TIMEOUT_PREDETERMINADO_MS;
}

/**
 * Elige el proveedor en el servidor. Sin clave para Gemini/Groq se queda en extractivo para no
 * romper la demo ni gastar cuota; la app nunca recibe la clave.
 */
export function crearProveedorAsistente(entorno: EntornoAsistente = process.env): ProveedorRespuesta {
  const nombre = (entorno.ASISTENTE_PROVEEDOR ?? "extractivo").trim().toLowerCase();
  if (!esProveedorLLM(nombre)) return new ProveedorExtractivo();

  const modelo = entorno.ASISTENTE_MODELO?.trim() || MODELOS_PREDETERMINADOS[nombre];
  const url = entorno.ASISTENTE_URL?.trim() || undefined;
  const timeoutMs = leerTimeout(entorno.ASISTENTE_TIMEOUT_MS);

  if (nombre === "gemini" || nombre === "groq") {
    const clave = entorno.ASISTENTE_CLAVE?.trim();
    if (!clave) return new ProveedorExtractivo();
    return new ProveedorLLM({ proveedor: nombre, modelo, clave, url, timeoutMs });
  }

  return new ProveedorLLM({ proveedor: nombre, modelo, url, timeoutMs });
}
