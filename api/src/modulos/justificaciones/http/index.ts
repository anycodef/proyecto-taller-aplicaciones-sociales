import { app } from "@azure/functions";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import { z } from "zod";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { limitarPorCuenta } from "../../../compartido/http/limites";
import { ErrorAplicacion, respuesta } from "../../../compartido/http/respuestas";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { crearLote } from "../aplicacion/crear-lote";
import { obtenerLecturaEvidencia, reservarEvidencia, subirArchivo } from "../aplicacion/evidencias";
import { listarJustificables, listarMisJustificaciones } from "../aplicacion/familia";
import { consultarBandeja, revisarJustificaciones } from "../aplicacion/revision";
import { obtenerAlmacenEvidencias } from "../infraestructura/almacen-evidencias-blob";

const uuid = z.string().uuid();
const esquemaReserva = z.object({ archivos: z.array(z.object({ bytes: z.number().int().positive(), contentType: z.string().max(60) }).strict()).min(1).max(10) }).strict();
const esquemaLote = z
  .object({
    loteId: uuid,
    causa: z.string().min(1).max(40),
    evidenciaId: uuid,
    ausencias: z.array(z.object({ catequizandoId: uuid, sesionId: uuid, justificacionId: uuid }).strict()).min(1).max(40),
  })
  .strict();
const esquemaRevision = z
  .object({ justificacionIds: z.array(uuid).min(1).max(100), decision: z.enum(["aprobada", "rechazada"]), motivo: z.string().max(1000).optional() })
  .strict();

function parametroUuid(valor: string | undefined): string {
  const resultado = uuid.safeParse(valor);
  if (!resultado.success) throw new ErrorAplicacion(404, "no_encontrada");
  return resultado.data;
}

export const manejadoresJustificaciones = {
  ausenciasJustificables: conAcceso({ accion: "justificacion:enviar" }, async (_req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificacion:justificables", 60, 60);
    return respuesta(await enTransaccion((tx) => listarJustificables(ctx, new Date(), tx)));
  }),
  misJustificaciones: conAcceso({ accion: "justificacion:enviar" }, async (_req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificacion:mias", 60, 60);
    return respuesta(await enTransaccion((tx) => listarMisJustificaciones(ctx, tx)));
  }),
  reservar: conAcceso({ accion: "justificacion:enviar" }, async (req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "evidencia:reservar", 10, 60);
    const cuerpo = await validarCuerpo(req, esquemaReserva);
    return respuesta(await enTransaccion((tx) => reservarEvidencia(ctx, cuerpo.archivos, new Date(), tx)), 201);
  }),
  subir: conAcceso({ accion: "justificacion:enviar" }, async (req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "evidencia:subir", 30, 60);
    const evidenciaId = parametroUuid(req.params.evidenciaId);
    const contenido = Buffer.from(await req.arrayBuffer());
    const resultado = await enTransaccion((tx) =>
      subirArchivo(ctx, evidenciaId, Number(req.params.orden), contenido, req.headers.get("content-type"), obtenerAlmacenEvidencias(), tx),
    );
    return respuesta(resultado);
  }),
  crearLote: conAcceso({ accion: "justificacion:enviar" }, async (req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificacion:lote", 10, 60);
    const cuerpo = await validarCuerpo(req, esquemaLote);
    return respuesta(await enTransaccion((tx) => crearLote(ctx, cuerpo, obtenerAlmacenEvidencias(), new Date(), tx)), 201);
  }),
  bandeja: conAcceso({ accion: "justificacion:leer" }, async (_req, ctx) => {
    // La matriz da lectura al catequista por grupos, pero la bandeja es del ciclo completo: solo coordinación y supervisión.
    if (!rolesEfectivos(ctx).some((rol) => rol === "coordinacion" || rol === "supervision")) throw new ErrorAplicacion(403, "fuera_de_alcance");
    await limitarPorCuenta(ctx.cuentaId, "justificacion:bandeja", 60, 60);
    return respuesta(await enTransaccion((tx) => consultarBandeja(tx)));
  }),
  revisar: conAcceso({ accion: "justificacion:revisar" }, async (req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificacion:revisar", 30, 60);
    const cuerpo = await validarCuerpo(req, esquemaRevision);
    return respuesta(await enTransaccion((tx) => revisarJustificaciones(ctx, cuerpo, new Date(), tx)));
  }),
  evidencia: conAcceso({ accion: "evidencia:leer" }, async (req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "evidencia:leer", 60, 60);
    const id = parametroUuid(req.params.id);
    return respuesta(await enTransaccion((tx) => obtenerLecturaEvidencia(ctx, id, obtenerAlmacenEvidencias(), new Date(), tx)));
  }),
};

let registrada = false;
export function registrarJustificaciones(): void {
  if (registrada) return;
  registrada = true;
  app.http("listarAusenciasJustificables", { methods: ["GET"], authLevel: "function", route: "familia/ausencias-justificables", handler: manejadoresJustificaciones.ausenciasJustificables });
  app.http("listarMisJustificaciones", { methods: ["GET"], authLevel: "function", route: "familia/justificaciones", handler: manejadoresJustificaciones.misJustificaciones });
  app.http("reservarEvidencia", { methods: ["POST"], authLevel: "function", route: "evidencias/reservas", handler: manejadoresJustificaciones.reservar });
  app.http("subirArchivoEvidencia", { methods: ["PUT"], authLevel: "function", route: "evidencias/{evidenciaId}/archivos/{orden}", handler: manejadoresJustificaciones.subir });
  app.http("crearLoteJustificaciones", { methods: ["POST"], authLevel: "function", route: "justificaciones/lotes", handler: manejadoresJustificaciones.crearLote });
  app.http("consultarBandejaJustificaciones", { methods: ["GET"], authLevel: "function", route: "justificaciones/bandeja", handler: manejadoresJustificaciones.bandeja });
  app.http("revisarJustificaciones", { methods: ["POST"], authLevel: "function", route: "justificaciones/revisiones", handler: manejadoresJustificaciones.revisar });
  app.http("obtenerEvidenciaJustificacion", { methods: ["GET"], authLevel: "function", route: "justificaciones/{id}/evidencia", handler: manejadoresJustificaciones.evidencia });
}
