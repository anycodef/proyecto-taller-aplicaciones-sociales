import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { z } from "zod";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { respuesta, ErrorAplicacion } from "../../../compartido/http/respuestas";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { abrirCiclo, cerrarCiclo, seleccionCiclo } from "../aplicacion/gestionar-ciclo";
import { limitarPorCuenta } from "../../../compartido/http/limites";
const esquema = z.object({ id: z.string().uuid(), nombre: z.string().min(1).max(150), fechaInicio: z.string(), fechaFin: z.string() }).strict();
function protegido(accion: string, manejador: (req: HttpRequest, ctx: ContextoAcceso, inv: InvocationContext) => Promise<HttpResponseInit>) {
  return conAcceso({ accion }, async (req, ctx, inv) => {
    await limitarPorCuenta(ctx.cuentaId, "ciclos:http", 30, 60);
    return manejador(req, ctx, inv);
  });
}
export const manejadoresCiclos = {
  listar: protegido("yo:leer", async (_req, ctx) => {
    if (!rolesEfectivos(ctx).some(rol => ["administracion", "coordinacion", "supervision"].includes(rol))) throw new ErrorAplicacion(403, "fuera_de_alcance");
    return enTransaccion(async tx => respuesta({ ciclos: (await tx.query(`SELECT ${seleccionCiclo} FROM ciclo ORDER BY inicio DESC,id`)).rows }));
  }),
  abierto: protegido("yo:leer", async () => enTransaccion(async tx => respuesta({ ciclo: (await tx.query(`SELECT ${seleccionCiclo} FROM ciclo WHERE estado='abierto'`)).rows[0] ?? null }))),
  abrir: protegido("ciclo:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquema);
    return enTransaccion(async tx => { const resultado = await abrirCiclo(datos, ctx, tx); return respuesta({ ciclo: resultado.ciclo }, resultado.creado ? 201 : 200); });
  }),
  cerrar: protegido("ciclo:gestionar", async (req, ctx) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success || req.query.size || (await req.text()).trim()) throw new ErrorAplicacion(422, "entrada_invalida");
    return enTransaccion(async tx => respuesta(await cerrarCiclo(id.data, ctx, tx)));
  }),
};
let registrado = false;
export function registrarHttpCiclos(): void {
  if (registrado) return; registrado = true;
  app.http("obtenerCicloAbierto", { methods: ["GET"], authLevel: "function", route: "ciclos/abierto", handler: manejadoresCiclos.abierto });
  app.http("listarCiclos", { methods: ["GET"], authLevel: "function", route: "ciclos", handler: manejadoresCiclos.listar });
  app.http("abrirCiclo", { methods: ["POST"], authLevel: "function", route: "ciclos", handler: manejadoresCiclos.abrir });
  app.http("cerrarCiclo", { methods: ["POST"], authLevel: "function", route: "ciclos/{id}/cerrar", handler: manejadoresCiclos.cerrar });
  app.http("cierreCiclo", { methods: ["POST"], authLevel: "function", route: "ciclos/{id}/cierre", handler: manejadoresCiclos.cerrar });
}
