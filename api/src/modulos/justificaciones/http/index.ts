import { app } from "@azure/functions";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { limitarPorCuenta } from "../../../compartido/http/limites";
import { respuesta } from "../../../compartido/http/respuestas";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { crearLote, esquemaLote } from "../aplicacion/crear-lote";
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

let registrada = false;
export function registrarJustificaciones(): void {
  if (registrada) return;
  registrada = true;
  app.http("listarAusenciasJustificables", { methods: ["GET"], authLevel: "function", route: "familia/ausencias-justificables", handler: manejadoresJustificaciones.ausenciasJustificables });
  app.http("listarSesionesAnticipables", { methods: ["GET"], authLevel: "function", route: "familia/sesiones-anticipables", handler: manejadoresJustificaciones.sesionesAnticipables });
  app.http("listarJustificacionesFamilia", { methods: ["GET"], authLevel: "function", route: "familia/justificaciones", handler: manejadoresJustificaciones.misJustificaciones });
  app.http("reservarEvidencia", { methods: ["POST"], authLevel: "function", route: "evidencias/reservas", handler: manejadoresJustificaciones.reservarEvidencia });
  app.http("crearLoteJustificaciones", { methods: ["POST"], authLevel: "function", route: "justificaciones/lotes", handler: manejadoresJustificaciones.crearLote });
}
