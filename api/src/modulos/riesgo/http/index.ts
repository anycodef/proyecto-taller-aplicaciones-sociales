import { app } from "@azure/functions";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { limitarPorCuenta } from "../../../compartido/http/limites";
import { respuesta } from "../../../compartido/http/respuestas";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { consultarListaRiesgo } from "../aplicacion/consultar-lista-riesgo";

export const manejadoresRiesgo = {
  listar: conAcceso({ accion: "riesgo:leer" }, async (_req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "riesgo:listar", 60, 60);
    const lista = await enTransaccion((tx) => consultarListaRiesgo(ctx, new Date(), tx));
    return respuesta(lista);
  }),
};

let registrada = false;
export function registrarRiesgo(): void {
  if (registrada) return;
  registrada = true;
  app.http("listarRiesgo", {
    methods: ["GET"],
    authLevel: "function",
    route: "riesgo",
    handler: manejadoresRiesgo.listar,
  });
}
