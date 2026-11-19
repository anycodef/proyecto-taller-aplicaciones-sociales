import { app } from "@azure/functions";
import { z } from "zod";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { limitarPorCuenta } from "../../../compartido/http/limites";
import { respuesta } from "../../../compartido/http/respuestas";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { registrarMetricasAsistente } from "../aplicacion/metricas";
import { preguntarAsistente } from "../aplicacion/preguntar";

export const esquemaPregunta = z
  .object({
    pregunta: z.string().trim().min(3).max(500),
  })
  .strict();

export const manejadoresAsistente = {
  preguntar: conAcceso({ accion: "asistente:consultar" }, async (req, ctx) => {
    await limitarPorCuenta(ctx.cuentaId, "asistente:preguntar", 20, 3600);
    const { pregunta } = await validarCuerpo(req, esquemaPregunta);
    const inicio = Date.now();
    const resultado = await preguntarAsistente(pregunta);
    void registrarMetricasAsistente(ctx.cuentaId, resultado, Date.now() - inicio).catch(() => undefined);
    return respuesta(resultado);
  }),
};

let registrada = false;
export function registrarAsistente(): void {
  if (registrada) return;
  registrada = true;
  app.http("preguntarAsistente", {
    methods: ["POST"],
    authLevel: "function",
    route: "asistente/preguntar",
    handler: manejadoresAsistente.preguntar,
  });
}
