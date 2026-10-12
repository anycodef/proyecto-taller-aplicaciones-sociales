import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { z } from "zod";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { respuesta, ErrorAplicacion } from "../../../compartido/http/respuestas";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { consultarCumplimiento } from "../aplicacion/consultar-cumplimiento";
import { gestionarActividadHttp } from "../aplicacion/gestionar-http";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { TIPOS_ACTIVIDAD } from "@/lib/actividades/catalogo-actividades";
import { limitarPorCuenta } from "../../../compartido/http/limites";
const camposActividad = { nombre: z.string().min(1).max(150), tipo: z.enum(TIPOS_ACTIVIDAD), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), estado: z.enum(["vigente", "cancelada"]) };
export const esquemaAltaActividad = z.object({ id: z.string().uuid(), cicloId: z.string().uuid(), ...camposActividad, estado: camposActividad.estado.default("vigente") }).strict();
export const esquemaCambiosActividad = z.object(camposActividad).partial().strict().refine(datos => Object.keys(datos).length > 0);
function protegido(accion: string, manejador: (req: HttpRequest, ctx: ContextoAcceso, inv: InvocationContext) => Promise<HttpResponseInit>) {
  return conAcceso({ accion }, async (req, ctx, inv) => {
    await limitarPorCuenta(ctx.cuentaId, "actividades:http", 30, 60);
    return manejador(req, ctx, inv);
  });
}
export const manejadoresActividades = {
  crear: protegido("actividad:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemaAltaActividad);
    return enTransaccion(async tx => { const resultado = await gestionarActividadHttp({ ...datos, estado: datos.estado ?? "vigente" }, ctx, tx); return respuesta(resultado.cuerpo, resultado.estadoHttp); });
  }),
  actualizar: protegido("actividad:gestionar", async (req, ctx) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) throw new ErrorAplicacion(422, "entrada_invalida");
    const cambios = await validarCuerpo(req, esquemaCambiosActividad);
    return enTransaccion(async tx => { const resultado = await gestionarActividadHttp({ id: id.data, cambios }, ctx, tx); return respuesta(resultado.cuerpo, resultado.estadoHttp); });
  }),
  listar: protegido("yo:leer", async (_req, ctx) => {
    if (!rolesEfectivos(ctx).some(rol => rol === "catequista" || rol === "coordinacion")) throw new ErrorAplicacion(403, "fuera_de_alcance");
    return enTransaccion(async tx => respuesta({ actividades: (await tx.query(`SELECT a.id,a.ciclo_id AS "cicloId",a.nombre,a.tipo,a.fecha::text,a.estado FROM actividad_obligatoria a JOIN ciclo c ON c.id=a.ciclo_id AND c.estado='abierto' WHERE a.eliminado_en IS NULL ORDER BY a.fecha,a.id`)).rows }));
  }),
  cumplimiento: protegido("yo:leer", async (req, ctx) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) throw new ErrorAplicacion(422, "entrada_invalida");
    return enTransaccion(async tx => respuesta(await consultarCumplimiento(id.data, ctx, tx)));
  }),
};
let registrado = false;
export function registrarHttpActividades(): void {
  if (registrado) return; registrado = true;
  app.http("listarActividades", { methods: ["GET"], authLevel: "function", route: "actividades", handler: manejadoresActividades.listar });
  app.http("crearActividad", { methods: ["POST"], authLevel: "function", route: "actividades", handler: manejadoresActividades.crear });
  app.http("actualizarActividad", { methods: ["PATCH"], authLevel: "function", route: "actividades/{id}", handler: manejadoresActividades.actualizar });
  app.http("cumplimientoActividad", { methods: ["GET"], authLevel: "function", route: "actividades/{id}/cumplimiento", handler: manejadoresActividades.cumplimiento });
}
