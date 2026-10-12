import { app } from "@azure/functions";
import { z } from "zod";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { ErrorAplicacion, respuesta } from "../../../compartido/http/respuestas";
import * as esquemas from "../../catequizandos/http/esquemas";
import { alcanceInscripcion, parametroUuid, proteger } from "../../catequizandos/http/comun";
import { inscribir, confirmarDuplicado } from "../aplicacion/inscribir";
import { anularInscripcion, documentosInscripcion, cambiarDocumento, listarDocumentosPendientes } from "../aplicacion/documentos";
export const manejadoresInscripciones = {
  inscribir: proteger("inscripcion:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.inscripcion), r = await inscribir(datos, ctx);
    return respuesta(r.datos, r.estado);
  }),
  confirmarDuplicado: proteger("inscripcion:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.confirmarDuplicado);
    return respuesta(await enTransaccion(tx => confirmarDuplicado(tx, datos.referencia, datos.esElMismo, ctx)));
  }),
  anular: proteger("inscripcion:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.anular);
    return respuesta(await enTransaccion(tx => anularInscripcion(tx, parametroUuid(req), datos, ctx)));
  }, alcanceInscripcion),
  documentos: proteger("documento:leer", async req => respuesta({ documentos: await enTransaccion(tx => documentosInscripcion(tx, parametroUuid(req))) }), alcanceInscripcion),
  cambiarDocumento: proteger("documento:escribir", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.documento);
    return respuesta(await enTransaccion(tx => cambiarDocumento(tx, parametroUuid(req), req.params.tipo ?? "", datos, ctx)));
  }, alcanceInscripcion),
  pendientes: proteger("inscripcion:gestionar", async req => {
    const filtros = z.object({ grupoId: esquemas.uuid.optional() }).strict().safeParse(Object.fromEntries(req.query));
    if (!filtros.success) throw new ErrorAplicacion(422, "entrada_invalida");
    return respuesta({ pendientes: await enTransaccion(tx => listarDocumentosPendientes(tx, parametroUuid(req, "cicloId"), filtros.data.grupoId)) });
  })
};
export function registrarInscripciones(): void {
  const rutas = [["inscribir", "POST", "inscripciones"], ["confirmarDuplicado", "POST", "inscripciones/duplicados/confirmar"], ["anular", "POST", "inscripciones/{id}/anular"], ["documentos", "GET", "inscripciones/{id}/documentos"], ["cambiarDocumento", "PUT", "inscripciones/{id}/documentos/{tipo}"], ["pendientes", "GET", "ciclos/{cicloId}/documentos-pendientes"]] as const;
  for (const [nombre, metodo, ruta] of rutas) app.http(`inscripciones-${nombre}`, { methods: [metodo], route: ruta, authLevel: "function", handler: manejadoresInscripciones[nombre] });
}
