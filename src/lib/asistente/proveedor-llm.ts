import { construirPrompt } from "./prompt";
import type { EntradaProveedor, ProveedorRespuesta, SalidaProveedor } from "./tipos";

export const PROVEEDORES_LLM = ["gemini", "groq", "ollama"] as const;
export type NombreProveedorLLM = (typeof PROVEEDORES_LLM)[number];

export type CodigoErrorProveedor =
  | "configuracion_invalida"
  | "tiempo_agotado"
  | "proveedor_no_disponible"
  | "respuesta_invalida";

export class ErrorProveedor extends Error {
  constructor(
    readonly codigo: CodigoErrorProveedor,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorProveedor";
  }
}

export type OpcionesProveedorLLM = {
  proveedor: NombreProveedorLLM;
  modelo: string;
  clave?: string;
  timeoutMs?: number;
  url?: string;
  fetchImpl?: typeof fetch;
};

const TIMEOUT_PREDETERMINADO_MS = 8000;

function respuestaNoDisponible(proveedor: NombreProveedorLLM, estado: number): ErrorProveedor {
  return new ErrorProveedor("proveedor_no_disponible", `${proveedor} respondió ${estado}`);
}

function textoDeGemini(cuerpo: unknown): string {
  const candidatos = (cuerpo as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidatos)) return "";
  const partes = (candidatos[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(partes)) return "";
  return partes
    .map((parte) =>
      typeof parte === "object" && parte !== null && "text" in parte && typeof (parte as { text?: unknown }).text === "string"
        ? (parte as { text: string }).text
        : "",
    )
    .join("")
    .trim();
}

function textoDeGroq(cuerpo: unknown): string {
  const opciones = (cuerpo as { choices?: unknown }).choices;
  if (!Array.isArray(opciones)) return "";
  const contenido = (opciones[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  return typeof contenido === "string" ? contenido.trim() : "";
}

function textoDeOllama(cuerpo: unknown): string {
  const mensaje = (cuerpo as { message?: { content?: unknown } }).message?.content;
  if (typeof mensaje === "string") return mensaje.trim();
  const respuesta = (cuerpo as { response?: unknown }).response;
  return typeof respuesta === "string" ? respuesta.trim() : "";
}

async function conTiempo<T>(timeoutMs: number, tarea: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await tarea(controlador.signal);
  } catch (error) {
    if (controlador.signal.aborted) {
      throw new ErrorProveedor("tiempo_agotado", "El proveedor tardó más de lo permitido");
    }
    throw error instanceof ErrorProveedor
      ? error
      : new ErrorProveedor("proveedor_no_disponible", "No se pudo consultar el proveedor");
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Adaptador de proveedores generativos. Solo recibe la pregunta y los fragmentos públicos que ya pasaron la guardia.
 * La clave vive en el servidor; este módulo no la registra ni la devuelve en la respuesta.
 */
export class ProveedorLLM implements ProveedorRespuesta {
  readonly proveedor: NombreProveedorLLM;
  readonly modelo: string;
  readonly timeoutMs: number;
  private readonly clave?: string;
  private readonly url?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opciones: OpcionesProveedorLLM) {
    if (opciones.proveedor !== "ollama" && !opciones.clave?.trim()) {
      throw new ErrorProveedor("configuracion_invalida", "Falta la clave del proveedor");
    }
    this.proveedor = opciones.proveedor;
    this.modelo = opciones.modelo;
    this.clave = opciones.clave?.trim();
    this.url = opciones.url;
    this.timeoutMs =
      opciones.timeoutMs && Number.isFinite(opciones.timeoutMs) && opciones.timeoutMs > 0
        ? opciones.timeoutMs
        : TIMEOUT_PREDETERMINADO_MS;
    this.fetchImpl = opciones.fetchImpl ?? fetch;
  }

  async generar({ pregunta, fragmentos }: EntradaProveedor): Promise<SalidaProveedor> {
    const prompt = construirPrompt(pregunta, fragmentos);
    const solicitud = this.solicitud(prompt);
    const respuesta = await conTiempo(this.timeoutMs, (signal) =>
      this.fetchImpl(solicitud.url, {
        method: "POST",
        headers: solicitud.cabeceras,
        body: JSON.stringify(solicitud.cuerpo),
        signal,
      }),
    );

    if (!respuesta.ok) throw respuestaNoDisponible(this.proveedor, respuesta.status);

    let cuerpo: unknown;
    try {
      cuerpo = await respuesta.json();
    } catch {
      throw new ErrorProveedor("respuesta_invalida", "El proveedor no devolvió JSON");
    }

    const texto =
      this.proveedor === "gemini"
        ? textoDeGemini(cuerpo)
        : this.proveedor === "groq"
          ? textoDeGroq(cuerpo)
          : textoDeOllama(cuerpo);
    if (!texto) throw new ErrorProveedor("respuesta_invalida", "El proveedor devolvió una respuesta vacía");

    return { texto, proveedor: this.proveedor, modelo: this.modelo };
  }

  private solicitud(prompt: string): { url: string; cabeceras: Record<string, string>; cuerpo: unknown } {
    if (this.proveedor === "gemini") {
      const base =
        this.url ?? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`;
      const separador = base.includes("?") ? "&" : "?";
      return {
        url: `${base}${separador}key=${encodeURIComponent(this.clave ?? "")}`,
        cabeceras: { "content-type": "application/json" },
        cuerpo: {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        },
      };
    }

    if (this.proveedor === "groq") {
      return {
        url: this.url ?? "https://api.groq.com/openai/v1/chat/completions",
        cabeceras: {
          "content-type": "application/json",
          authorization: `Bearer ${this.clave ?? ""}`,
        },
        cuerpo: {
          model: this.modelo,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 512,
        },
      };
    }

    return {
      url: this.url ?? "http://127.0.0.1:11434/api/chat",
      cabeceras: { "content-type": "application/json" },
      cuerpo: {
        model: this.modelo,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature: 0.2, num_predict: 512 },
      },
    };
  }
}
