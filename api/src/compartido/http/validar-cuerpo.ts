import type { HttpRequest } from "@azure/functions";
import type { z } from "zod";
import { ErrorAplicacion } from "./respuestas";

export async function validarCuerpo<T>(peticion: HttpRequest, esquema: z.ZodType<T>): Promise<T> {
  let cuerpo: unknown;
  try { cuerpo = await peticion.json(); } catch { throw new ErrorAplicacion(422, "entrada_invalida"); }
  const resultado = esquema.safeParse(cuerpo);
  if (!resultado.success) throw new ErrorAplicacion(422, "entrada_invalida");
  return resultado.data;
}
