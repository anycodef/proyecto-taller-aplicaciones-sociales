import { app } from "@azure/functions";
import type { HttpRequest } from "@azure/functions";
import type { RecursoAlcance } from "@/lib/seguridad/contexto-acceso";
import { consultar } from "../../../compartido/bd/pool";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { limitarPorCuenta } from "../../../compartido/http/limites";
import { recursoCatequizando } from "../../../compartido/http/recursos";
import { ErrorAplicacion, respuesta } from "../../../compartido/http/respuestas";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { consultarBandeja, consultarPlazo, definirPlazo, esquemaPlazo, esquemaRevision, historialCatequizando, justificablesParaCoordinacion, obtenerEvidencia, revisarJustificaciones } from "../aplicacion/coordinacion";
import { crearLote, esquemaLote } from "../aplicacion/crear-lote";
import { CRON_LIMPIAR_HUERFANAS, limpiarEvidenciasHuerfanas } from "../aplicacion/limpiar-huerfanas";
import { listarAnticipables, listarJustificables, listarMisJustificaciones } from "../aplicacion/familia";
import { esquemaReserva, reservarEvidencia } from "../aplicacion/reservar-evidencia";
import { obtenerAlmacenEvidencias } from "../infraestructura/almacen";

/** Límites por cuenta con el contador atómico de 001; APIM solo aplica el global (RNF-403). */
export const LIMITE_ESCRITURAS_POR_MINUTO = 10;
export const LIMITE_RESERVAS_POR_HORA = 20;

async function limitarEscritura(cuentaId: string, operacion: "reserva" | "lote"): Promise<void> {
  await limitarPorCuenta(cuentaId, `justificaciones:${operacion}`, LIMITE_ESCRITURAS_POR_MINUTO, 60);
  if (operacion === "reserva") await limitarPorCuenta(cuentaId, "justificaciones:reserva:hora", LIMITE_RESERVAS_POR_HORA, 3600);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parametroId(req: HttpRequest): string {
  const id = req.params.id ?? "";
  if (!uuid.test(id)) throw new ErrorAplicacion(422, "entrada_invalida");
  return id;
}
/** El alcance de una evidencia es el del niño de su justificación (RF-410). */
async function recursoJustificacion(req: HttpRequest): Promise<RecursoAlcance> {
  const id = parametroId(req);
  const fila = await consultar<{ catequizando_id: string }>("SELECT catequizando_id FROM justificacion WHERE id=$1", [id]);
  return fila.rows[0] ? recursoCatequizando(fila.rows[0].catequizando_id) : { catequizandoId: id };
}

export const manejadoresJustificaciones = {
  ausenciasJustificables: conAcceso({ accion: "justificacion:familia" }, async (_req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificaciones:familia", 60, 60);
    return respuesta(await enTransaccion(tx => listarJustificables(ctx, new Date(), tx)));
  }),
  sesionesAnticipables: conAcceso({ accion: "justificacion:familia" }, async (_req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificaciones:familia", 60, 60);
    return respuesta(await enTransaccion(tx => listarAnticipables(ctx, new Date(), tx)));
  }),
  misJustificaciones: conAcceso({ accion: "justificacion:familia" }, async (_req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificaciones:familia", 60, 60);
    return respuesta({ justificaciones: await enTransaccion(tx => listarMisJustificaciones(ctx, tx)) });
  }),
  reservarEvidencia: conAcceso({ accion: "justificacion:enviar" }, async (req, ctx) => {
    const entrada = await validarCuerpo(req, esquemaReserva);
    await limitarEscritura(ctx.cuentaId, "reserva");
    return respuesta(await enTransaccion(tx => reservarEvidencia(entrada, ctx, obtenerAlmacenEvidencias(), new Date(), tx)), 201);
  }),
  crearLote: conAcceso({ accion: "justificacion:enviar" }, async (req, ctx) => {
    const entrada = await validarCuerpo(req, esquemaLote);
    await limitarEscritura(ctx.cuentaId, "lote");
    const resultado = await enTransaccion(tx => crearLote(entrada, ctx, obtenerAlmacenEvidencias(), new Date(), tx));
    const justificaciones = resultado.justificaciones.map(j => ({ id: j.id, catequizandoId: j.catequizandoId, sesionId: j.sesionId, tipoSesion: j.tipoSesion, fecha: j.fecha, anticipada: j.anticipada, estado: "pendiente" as const }));
    return respuesta({ loteId: entrada.loteId, evidenciaId: entrada.evidenciaId, justificaciones }, resultado.creado ? 201 : 200);
  }),
};

export const manejadoresCoordinacion = {
  obtenerPlazo: conAcceso({ accion: "justificacion:plazo-leer" }, async (req) => respuesta(await enTransaccion(tx => consultarPlazo(parametroId(req), tx)))),
  definirPlazo: conAcceso({ accion: "justificacion:configurar-plazo" }, async (req, ctx) => {
    const id = parametroId(req);
    const { diasPlazo } = await validarCuerpo(req, esquemaPlazo);
    return respuesta(await enTransaccion(tx => definirPlazo(id, diasPlazo, ctx, new Date(), tx)));
  }),
  bandeja: conAcceso({ accion: "justificacion:bandeja" }, async (_req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificaciones:bandeja", 60, 60);
    return respuesta(await enTransaccion(tx => consultarBandeja(tx)));
  }),
  revisar: conAcceso({ accion: "justificacion:revisar" }, async (req, ctx) => {
    const entrada = await validarCuerpo(req, esquemaRevision);
    await limitarPorCuenta(ctx.cuentaId, "justificaciones:revision", 30, 60);
    return respuesta({ revisadas: await enTransaccion(tx => revisarJustificaciones(entrada, ctx, new Date(), tx)) });
  }),
  evidencia: conAcceso({ accion: "evidencia:leer", recurso: recursoJustificacion }, async (req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "justificaciones:evidencia", 60, 60);
    return respuesta(await enTransaccion(tx => obtenerEvidencia(parametroId(req), ctx, obtenerAlmacenEvidencias(), new Date(), tx)));
  }),
  historial: conAcceso({ accion: "justificacion:historial", recurso: req => recursoCatequizando(parametroId(req)) }, async (req) =>
    respuesta(await enTransaccion(tx => historialCatequizando(parametroId(req), tx)))),
  justificablesDeNino: conAcceso({ accion: "justificacion:registrar-en-nombre" }, async (req) =>
    respuesta(await enTransaccion(tx => justificablesParaCoordinacion(parametroId(req), new Date(), tx)))),
};

let registrada = false;
export function registrarJustificaciones(): void {
  if (registrada) return;
  registrada = true;
  app.http("listarAusenciasJustificables", { methods: ["GET"], authLevel: "function", route: "familia/ausencias-justificables", handler: manejadoresJustificaciones.ausenciasJustificables });
  app.http("listarSesionesAnticipables", { methods: ["GET"], authLevel: "function", route: "familia/sesiones-anticipables", handler: manejadoresJustificaciones.sesionesAnticipables });
  app.http("listarJustificacionesFamilia", { methods: ["GET"], authLevel: "function", route: "familia/justificaciones", handler: manejadoresJustificaciones.misJustificaciones });
  app.http("reservarEvidencia", { methods: ["POST"], authLevel: "function", route: "evidencias/reservas", handler: manejadoresJustificaciones.reservarEvidencia });
  app.http("obtenerPlazoJustificacion", { methods: ["GET"], authLevel: "function", route: "ciclos/{id}/plazo-justificacion", handler: manejadoresCoordinacion.obtenerPlazo });
  app.http("definirPlazoJustificacion", { methods: ["PUT"], authLevel: "function", route: "ciclos/{id}/plazo-justificacion", handler: manejadoresCoordinacion.definirPlazo });
  app.http("bandejaJustificaciones", { methods: ["GET"], authLevel: "function", route: "justificaciones/bandeja", handler: manejadoresCoordinacion.bandeja });
  app.http("revisarJustificaciones", { methods: ["POST"], authLevel: "function", route: "justificaciones/revisiones", handler: manejadoresCoordinacion.revisar });
  app.http("evidenciaJustificacion", { methods: ["GET"], authLevel: "function", route: "justificaciones/{id}/evidencia", handler: manejadoresCoordinacion.evidencia });
  app.http("historialJustificaciones", { methods: ["GET"], authLevel: "function", route: "catequizandos/{id}/justificaciones", handler: manejadoresCoordinacion.historial });
  app.http("justificablesCoordinacion", { methods: ["GET"], authLevel: "function", route: "coordinacion/catequizandos/{id}/ausencias-justificables", handler: manejadoresCoordinacion.justificablesDeNino });
  app.http("crearLoteJustificaciones", { methods: ["POST"], authLevel: "function", route: "justificaciones/lotes", handler: manejadoresJustificaciones.crearLote });
  app.timer("limpiarEvidenciasHuerfanas", { schedule: CRON_LIMPIAR_HUERFANAS, handler: async () => { await limpiarEvidenciasHuerfanas(new Date()); } });
}
