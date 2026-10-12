import { app, type HttpRequest } from "@azure/functions";
import { gzipSync } from "node:zlib";
import { z } from "zod";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { limitarPorCuenta } from "../../../compartido/http/limites";
import { ErrorAplicacion, respuesta } from "../../../compartido/http/respuestas";
import { pull } from "../aplicacion/pull";
import { aplicarPush } from "../aplicacion/push";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { registrarBitacora } from "../infraestructura/bitacora-pg";
import { traducirErrorAsistencia } from "../../asistencia/http";
const esquemaMigracion = z.object({ tablas: z.array(z.string()).max(50), columnas: z.array(z.object({ tabla: z.string(), columnas: z.array(z.string()).max(100) }).strict()).max(50).optional() }).strict();
export async function leerCuerpoAcotado(req: HttpRequest): Promise<string> {
  const maximo = 512 * 1024;
  const longitud = req.headers.get("content-length");
  if (longitud && Number(longitud) > maximo) throw new ErrorAplicacion(413, "lote_demasiado_grande");
  const lector = req.body?.getReader();
  if (!lector) return "";
  const fragmentos: Buffer[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const fragmento = await lector.read();
      if (fragmento.done) break;
      bytes += fragmento.value.byteLength;
      if (bytes > maximo) { await lector.cancel(); throw new ErrorAplicacion(413, "lote_demasiado_grande"); }
      fragmentos.push(Buffer.from(fragmento.value));
    }
  } finally { lector.releaseLock(); }
  return Buffer.concat(fragmentos, bytes).toString("utf8");
}
export const manejadoresSincronizacion = {
  pull: conAcceso({ accion: "sincronizacion:operar" }, async (req, cuenta) => {
    const inicio = Date.now();
    try {
      await limitarPorCuenta(cuenta.cuentaId, "sincronizacion:cambios", 30, 60);
      const textoPulso = req.query.get("ultimoPulso");
      const ultimoPulso = textoPulso === null || textoPulso === "null" ? null : Number(textoPulso);
      const versionEsquema = Number(req.query.get("versionEsquema") ?? "1");
      let migracion: z.infer<typeof esquemaMigracion> | undefined;
      const textoMigracion = req.query.get("migracion");
      if (textoMigracion) {
        if (textoMigracion.length > 8192) throw new ErrorAplicacion(422, "migracion_invalida");
        try { migracion = esquemaMigracion.parse(JSON.parse(textoMigracion)); }
        catch { throw new ErrorAplicacion(422, "migracion_invalida"); }
      }
      const resultado = await pull({ ultimoPulso, versionEsquema, huellaAlcance: req.query.get("huellaAlcance"), migracion }, cuenta);
      const texto = JSON.stringify(resultado);
      const aceptaGzip = (req.headers.get("accept-encoding") ?? "").split(",").some(codificacion => /^\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?\s*$)[\d.]+)?\s*$/i.test(codificacion));
      const cuerpo = aceptaGzip ? gzipSync(texto) : texto;
      await registrarBitacora(cuenta, "pull", inicio, Buffer.byteLength(req.url), Buffer.byteLength(cuerpo), versionEsquema);
      return { status: 200, body: cuerpo, headers: { "Cache-Control": "no-store", "Content-Type": "application/json", "x-hora-servidor": String(resultado.timestamp), "Vary": "Accept-Encoding", ...(aceptaGzip ? { "Content-Encoding": "gzip" } : {}) } };
    } catch (error) { return traducirErrorAsistencia(error); }
  }),
  push: conAcceso({ accion: "sincronizacion:operar" }, async (req, cuenta) => {
    const inicio = Date.now();
    try {
      await limitarPorCuenta(cuenta.cuentaId, "sincronizacion:cambios", 30, 60);
      const texto = await leerCuerpoAcotado(req);
      let entrada: unknown;
      try { entrada = JSON.parse(texto); } catch { throw new ErrorAplicacion(422, "entrada_invalida"); }
      const resultado = await enTransaccion(async tx => {
        const resumen = await aplicarPush(entrada, cuenta, tx);
        await registrarBitacora(cuenta, "push", inicio, Buffer.byteLength(texto), Buffer.byteLength(JSON.stringify(resumen)), 1, resumen, tx);
        return resumen;
      });
      return { ...respuesta(resultado), headers: { "Cache-Control": "no-store", "x-hora-servidor": String(Date.now()) } };
    } catch (error) { return traducirErrorAsistencia(error); }
  }),
};
let registrada = false;
export function registrarSincronizacion(): void {
  if (registrada) return;
  registrada = true;
  app.http("sincronizacionPull", { methods: ["GET"], authLevel: "function", route: "sincronizacion/cambios", handler: manejadoresSincronizacion.pull });
  app.http("sincronizacionPush", { methods: ["POST"], authLevel: "function", route: "sincronizacion/cambios", handler: manejadoresSincronizacion.push });
}
