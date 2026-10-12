import { app } from "@azure/functions";
import { z } from "zod";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { respuesta, ErrorAplicacion } from "../../../compartido/http/respuestas";
import { publicarAviso, retirarAviso } from "../index";
export const manejadoresAvisos = {
  publicar: conAcceso({ accion: "aviso:publicar" }, async (req, ctx) => {
    const datos = await validarCuerpo(req, z.object({ id: z.string().uuid(), grupoId: z.string().uuid(), texto: z.string().min(1).max(500) }).strict());
    return respuesta({ id: datos.id }, await publicarAviso(datos, ctx) ? 201 : 200);
  }),
  retirar: conAcceso({ accion: "aviso:publicar" }, async (req, ctx) => {
    await validarCuerpo(req, z.object({}).strict());
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) throw new ErrorAplicacion(422, "entrada_invalida");
    await retirarAviso(id.data, ctx);
    return respuesta({ retirado: true });
  }),
};
export function registrarAvisos(): void {
  app.http("publicarAviso", { route: "avisos", methods: ["POST"], authLevel: "function", handler: manejadoresAvisos.publicar });
  app.http("retirarAviso", { route: "avisos/{id}/retirar", methods: ["POST"], authLevel: "function", handler: manejadoresAvisos.retirar });
}
