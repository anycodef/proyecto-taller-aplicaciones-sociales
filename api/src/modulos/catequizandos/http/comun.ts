import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import type { ContextoAcceso, RecursoAlcance } from "@/lib/seguridad/contexto-acceso";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { ErrorAplicacion, respuesta } from "../../../compartido/http/respuestas";
import { recursoCatequizando, recursoInscripcion } from "../../../compartido/http/recursos";
import { uuid } from "./esquemas";
export function parametroUuid(req: HttpRequest, nombre = "id"): string {
  const resultado = uuid.safeParse(req.params[nombre]);
  if (!resultado.success) throw new ErrorAplicacion(422, "entrada_invalida");
  return resultado.data;
}
export const alcanceNino = (req: HttpRequest) => recursoCatequizando(parametroUuid(req));
export const alcanceInscripcion = (req: HttpRequest) => recursoInscripcion(parametroUuid(req));
export const alcanceGrupo = async (req: HttpRequest): Promise<RecursoAlcance> => ({ grupoId: parametroUuid(req) });
type Manejador = (req: HttpRequest, ctx: ContextoAcceso, inv: InvocationContext) => Promise<HttpResponseInit>;
export function proteger(accion: string, manejador: Manejador, recurso?: (req: HttpRequest) => Promise<RecursoAlcance>) {
  return conAcceso({ accion, recurso }, async (req, contexto, invocacion) => {
    try { return await manejador(req, contexto, invocacion); }
    catch (error) {
      if (error instanceof ErrorAplicacion) return respuesta({ codigo: error.codigo }, error.estado);
      const codigo = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (["23505", "40001", "40P01"].includes(String(codigo))) return respuesta({ codigo: "conflicto" }, 409);
      if (["23514", "23503", "22001"].includes(String(codigo))) return respuesta({ codigo: "entrada_invalida" }, 422);
      return respuesta({ codigo: "error_interno" }, 500);
    }
  });
}
