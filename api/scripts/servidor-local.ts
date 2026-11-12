/*
 * Servidor HTTP local para la demo cuando no hay Azure Functions Core Tools: registra los handlers reales de las Functions
 * en memoria y los sirve en http://127.0.0.1:7071/api con CORS abierto. Es solo para desarrollo y demo; no sustituye al host
 * de Functions (sin temporizadores, sin autenticación de función). Variables: BD_URL, BLOBS_CONEXION, URL_WEB (https),
 * JWT_CLAVE, RENOVACION_CLAVE. Puerto con PUERTO_API (7071 por defecto).
 */
import { createServer } from "node:http";
import { cerrarPool } from "../src/compartido/bd/pool";

// El módulo se debe cargar después de reemplazar app.http, por eso se usa require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const af = require("@azure/functions");
type Entrada = { metodos: string[]; patron: RegExp; nombres: string[]; handler: (req: unknown, inv: unknown) => Promise<{ status?: number; jsonBody?: unknown; body?: unknown; headers?: Record<string, string> }> };
const rutas: Entrada[] = [];
af.app.http = (_nombre: string, o: { methods: string[]; route: string; handler: Entrada["handler"] }) => {
  const nombres: string[] = [];
  const patron = new RegExp("^" + o.route.replace(/\{(\w+)\}/g, (_m, n) => { nombres.push(n); return "([^/]+)"; }) + "$");
  rutas.push({ metodos: o.methods, patron, nombres, handler: o.handler });
};
af.app.timer = () => undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../src/index");

const PUERTO = Number(process.env.PUERTO_API ?? 7071);
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,ocp-apim-subscription-key,accept",
};

const servidor = createServer(async (req, res) => {
  const enviar = (estado: number, cuerpo?: unknown, cabeceras: Record<string, string> = {}) => {
    res.writeHead(estado, { ...CORS, ...(cuerpo === undefined ? {} : { "content-type": "application/json" }), ...cabeceras });
    res.end(cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
  };
  try {
    if (req.method === "OPTIONS") return enviar(204);
    const url = new URL(req.url ?? "/", "http://local");
    const camino = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
    const metodo = (req.method ?? "GET").toUpperCase();
    for (const r of rutas) {
      if (!r.metodos.includes(metodo)) continue;
      const m = camino.match(r.patron);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      const trozos: Buffer[] = [];
      for await (const trozo of req) trozos.push(trozo as Buffer);
      const bytes = Buffer.concat(trozos);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers[k] = v;
      const esTexto = /json|text/.test(headers["content-type"] ?? "");
      const peticion = new af.HttpRequest({
        method: metodo, url: url.toString(), headers, params,
        ...(bytes.length ? { body: esTexto ? { string: bytes.toString("utf8") } : { bytes: new Uint8Array(bytes) } } : {}),
      });
      const r2 = await r.handler(peticion, { log: () => undefined, error: () => undefined, warn: () => undefined });
      console.info(`${metodo} /${camino} -> ${r2.status ?? 200}${(r2.jsonBody as { codigo?: string } | undefined)?.codigo ? ` ${(r2.jsonBody as { codigo: string }).codigo}` : ""}`);
      return enviar(r2.status ?? 200, r2.jsonBody ?? r2.body, r2.headers);
    }
    console.info(`${metodo} /${camino} -> 404 sin ruta`);
    enviar(404, { codigo: "no_encontrada" });
  } catch {
    enviar(500, { codigo: "error_interno" });
  }
});

servidor.listen(PUERTO, "0.0.0.0", () => console.info(`API local en http://127.0.0.1:${PUERTO}/api (${rutas.length} rutas)`));
process.on("SIGINT", () => { servidor.close(); void cerrarPool().finally(() => process.exit(0)); });
