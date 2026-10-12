import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import type { ContextoAcceso, RecursoAlcance } from "@/lib/seguridad/contexto-acceso";
import { autorizar } from "@/lib/seguridad/autorizacion";
import { autenticarPeticion, auditar } from "../../modulos/seguridad";
import { ErrorAplicacion, respuesta, noAutorizado, fueraDeAlcance } from "./respuestas";

export function conAcceso(opciones: { accion: string; recurso?: (req: HttpRequest) => Promise<RecursoAlcance> }, manejador: (req: HttpRequest, ctx: ContextoAcceso, inv: InvocationContext) => Promise<HttpResponseInit>) {
  return async (req: HttpRequest, inv: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const contexto = await autenticarPeticion(req);
      if (!contexto) return noAutorizado();
      const recurso = await opciones.recurso?.(req);
      if (!autorizar(contexto, opciones.accion, recurso).permitido) {
        await auditar(contexto, { accion: opciones.accion, recursoId: recurso?.catequizandoId ?? recurso?.grupoId, catequizandoId: recurso?.catequizandoId, resultado: "denegado" });
        return fueraDeAlcance();
      }
      return await manejador(req, contexto, inv);
    } catch (error) {
      if (error instanceof ErrorAplicacion) return respuesta({ codigo: error.codigo }, error.estado);
      const codigo = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (codigo === "23505" || codigo === "23514" || codigo === "SG801") return respuesta({ codigo: "conflicto" }, 409);
      return respuesta({ codigo: "error_interno" }, 500);
    }
  };
}
