import { app } from "@azure/functions";
import { z } from "zod";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { ErrorAplicacion, respuesta } from "../../../compartido/http/respuestas";
import * as esquemas from "./esquemas";
import { alcanceNino, alcanceGrupo, alcanceInscripcion, parametroUuid, proteger } from "./comun";
import { consultarPerfil, corregirCatequizando, consultarCambios } from "../aplicacion/perfil";
import { consultarCondiciones, registrarCondiciones } from "../aplicacion/condiciones";
import { crearGrupo, editarGrupo, cerrarGrupo, asignarCatequistas, listarGrupos, asignarGrupo } from "../aplicacion/grupos";
import { consultarCarnes, reemitirCarne } from "../aplicacion/carnes";
import { vincularApoderado, desvincularApoderado } from "../aplicacion/apoderados";
import { auditarAcceso } from "../infraestructura/auditoria";
import { cicloAbierto } from "../infraestructura/comun";
export const manejadoresCatequizandos = {
  perfil: proteger("perfil:leer", async (req, ctx) => enTransaccion(async tx => {
    const id = parametroUuid(req), perfil = await consultarPerfil(tx, id, ctx);
    await auditarAcceso(tx, ctx, "perfil:leer", id);
    return respuesta(perfil);
  }), alcanceNino),
  corregir: proteger("inscripcion:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.corregir);
    return respuesta(await enTransaccion(tx => corregirCatequizando(tx, parametroUuid(req), datos, ctx)));
  }, alcanceNino),
  cambios: proteger("inscripcion:gestionar", async req => respuesta({ cambios: await enTransaccion(tx => consultarCambios(tx, parametroUuid(req))) }), alcanceNino),
  condiciones: proteger("restringido:leer", async (req, ctx) => respuesta({ condiciones: await enTransaccion(tx => consultarCondiciones(tx, parametroUuid(req), ctx)) }), alcanceNino),
  guardarCondiciones: proteger("restringido:escribir", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.condiciones);
    return respuesta(await enTransaccion(tx => registrarCondiciones(tx, parametroUuid(req), datos, ctx)));
  }, alcanceNino),
  buscarApoderados: proteger("apoderado:gestionar", async (req, ctx) => enTransaccion(async tx => {
    const datos = z.object({ q: z.string().trim().min(2).max(100) }).strict().safeParse(Object.fromEntries(req.query));
    if (!datos.success) throw new ErrorAplicacion(422, "entrada_invalida");
    const maximo = Number(process.env.LIMITE_BUSQUEDAS_APODERADOS ?? 10);
    if (!Number.isInteger(maximo) || maximo < 1 || maximo > 60) throw new ErrorAplicacion(503, "limite_no_configurado");
    const contador = await tx.query<{ cantidad: number }>("INSERT INTO contador_busqueda_apoderado(cuenta_id,ventana,cantidad) VALUES($1,date_trunc('minute',clock_timestamp()),1) ON CONFLICT(cuenta_id) DO UPDATE SET ventana=EXCLUDED.ventana,cantidad=CASE WHEN contador_busqueda_apoderado.ventana=EXCLUDED.ventana THEN contador_busqueda_apoderado.cantidad+1 ELSE 1 END RETURNING cantidad", [ctx.cuentaId]);
    // No lanzar dentro de la transacción: el incremento debe persistir también al devolver 429.
    if (contador.rows[0].cantidad > maximo) return respuesta({ codigo: "limite_excedido" }, 429);
    const patron = `%${datos.data.q.replace(/[\\%_]/g, "\\$&")}%`;
    const apoderados = await tx.query('SELECT id,nombres,apellidos,tipo_contacto AS "tipoContacto",valor_contacto AS "valorContacto" FROM apoderado WHERE (nombres ILIKE $1 OR apellidos ILIKE $1 OR valor_contacto ILIKE $1) AND valor_contacto<>\'retirado\' ORDER BY apellidos,nombres,id LIMIT 30', [patron]);
    return respuesta({ apoderados: apoderados.rows });
  })),
  vincular: proteger("apoderado:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.vincular);
    return respuesta(await enTransaccion(tx => vincularApoderado(tx, parametroUuid(req), datos.vinculo, datos.cambioId, ctx)));
  }, alcanceNino),
  desvincular: proteger("apoderado:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.desvincular);
    return respuesta(await enTransaccion(tx => desvincularApoderado(tx, parametroUuid(req), parametroUuid(req, "apoderadoId"), datos.cambioId, ctx, datos.motivo)));
  }, alcanceNino),
  grupos: proteger("grupo:leer", async (req, ctx) => respuesta({ grupos: await enTransaccion(tx => listarGrupos(tx, parametroUuid(req, "cicloId"), ctx)) })),
  crearGrupo: proteger("grupo:gestionar", async req => {
    const datos = await validarCuerpo(req, esquemas.grupo), r = await enTransaccion(tx => crearGrupo(tx, datos));
    return respuesta(r.datos, r.estado);
  }),
  editarGrupo: proteger("grupo:gestionar", async req => {
    const datos = await validarCuerpo(req, esquemas.editarGrupo);
    return respuesta(await enTransaccion(tx => editarGrupo(tx, parametroUuid(req), datos)));
  }, alcanceGrupo),
  cerrarGrupo: proteger("grupo:gestionar", async req => {
    await validarCuerpo(req, z.object({}).strict());
    return respuesta(await enTransaccion(tx => cerrarGrupo(tx, parametroUuid(req))));
  }, alcanceGrupo),
  catequistas: proteger("grupo:gestionar", async req => {
    const datos = await validarCuerpo(req, esquemas.catequistas);
    return respuesta(await enTransaccion(tx => asignarCatequistas(tx, parametroUuid(req), datos)));
  }, alcanceGrupo),
  sugerencias: proteger("grupo:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.sugerencia);
    return respuesta({ grupos: await enTransaccion(async tx => listarGrupos(tx, (await cicloAbierto(tx)).id, ctx, datos)) });
  }),
  asignarGrupo: proteger("inscripcion:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.asignar);
    return respuesta(await enTransaccion(tx => asignarGrupo(tx, parametroUuid(req), datos, ctx)));
  }, alcanceInscripcion),
  carne: proteger("carne:gestionar", async req => {
    const carnes = await enTransaccion(tx => consultarCarnes(tx, { catequizandoId: parametroUuid(req) }));
    if (!carnes[0]) throw new ErrorAplicacion(409, "catequizando_inactivo");
    return respuesta(carnes[0]);
  }, alcanceNino),
  carnesGrupo: proteger("carne:gestionar", async req => respuesta({ carnes: await enTransaccion(tx => consultarCarnes(tx, { grupoId: parametroUuid(req) })) }), alcanceGrupo),
  reemitir: proteger("carne:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemas.reemitir);
    return respuesta(await enTransaccion(tx => reemitirCarne(tx, parametroUuid(req), datos.emisionEsperada, ctx)));
  }, alcanceNino)
};
export function registrarCatequizandos(): void {
  const rutas = [
    ["perfil", "GET", "catequizandos/{id}/perfil"], ["corregir", "PATCH", "catequizandos/{id}"], ["cambios", "GET", "catequizandos/{id}/cambios"],
    ["condiciones", "GET", "catequizandos/{id}/condiciones"], ["guardarCondiciones", "PUT", "catequizandos/{id}/condiciones"],
    ["buscarApoderados", "GET", "apoderados"], ["vincular", "POST", "catequizandos/{id}/apoderados"], ["desvincular", "DELETE", "catequizandos/{id}/apoderados/{apoderadoId}"],
    ["grupos", "GET", "ciclos/{cicloId}/grupos"], ["crearGrupo", "POST", "grupos"], ["editarGrupo", "PATCH", "grupos/{id}"], ["cerrarGrupo", "POST", "grupos/{id}/cerrar"],
    ["catequistas", "PUT", "grupos/{id}/catequistas"], ["sugerencias", "POST", "grupos/sugerencias"], ["asignarGrupo", "PUT", "inscripciones/{id}/grupo"],
    ["carne", "GET", "catequizandos/{id}/carne"], ["carnesGrupo", "GET", "grupos/{id}/carnes"], ["reemitir", "POST", "catequizandos/{id}/carne/reemitir"]
  ] as const;
  for (const [nombre, metodo, ruta] of rutas) app.http(`catequizandos-${nombre}`, { methods: [metodo], route: ruta, authLevel: "function", handler: manejadoresCatequizandos[nombre] });
}
