import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { z } from "zod";
import { ROLES, rolesEfectivos, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { respuesta, ErrorAplicacion } from "../../../compartido/http/respuestas";
import { consultar } from "../../../compartido/bd/pool";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { entrar, renovar, reportarBloqueo } from "../aplicacion/acceso";
import { crearCuenta, listarCuentas, reemplazarRoles, desactivarCuenta, emitirEnlace, revocarEnlace } from "../aplicacion/cuentas";
import { crearDelegacion, revocarDelegacion } from "../aplicacion/delegaciones";
import { registrarConsentimiento } from "../aplicacion/consentimientos";
import { auditar } from "../aplicacion/auditar";
import { retirarConsentimiento, vencerCiclo, borrarBlobsPendientes } from "../aplicacion/motor-retencion";
const uuid = z.string().uuid();
const token = z.string().length(43).regex(/^[A-Za-z0-9_-]{43}$/);
const roles = z.array(z.enum(ROLES)).min(1).max(5).refine(valores => new Set(valores).size === valores.length);
const identidadReal = z.object({ nombres: z.string().trim().min(1).max(150), apellidos: z.string().trim().min(1).max(150), fechaNacimiento: z.string().date().optional() }).strict();
const altaCuenta = z.object({ id: uuid, identidadOperativa: z.string().trim().min(1).max(150), esMenor: z.boolean(), roles, identidadReal: identidadReal.optional() }).strict();
const esquemaConsentimiento = z.object({ id: uuid, catequizandoId: uuid, apoderadoId: uuid, textoId: uuid, canal: z.enum(["presencial", "enlace"]) }).strict();
function id(req: HttpRequest): string {
  const valor = uuid.safeParse(req.params.id);
  if (!valor.success) throw new ErrorAplicacion(422, "entrada_invalida");
  return valor.data;
}
type Manejador = (req: HttpRequest, ctx: ContextoAcceso, inv: InvocationContext) => Promise<HttpResponseInit>;
export function traducirError(error: unknown): HttpResponseInit {
  if (error instanceof ErrorAplicacion) return respuesta({ codigo: error.codigo }, error.estado);
  const codigo = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (codigo === "23505") return respuesta({ codigo: "conflicto" }, 409);
  if (codigo === "23514") return respuesta({ codigo: error instanceof Error && error.message === "ultimo_administrador" ? "ultimo_administrador" : "regla_de_dominio" }, 409);
  if (codigo === "40001" || codigo === "40P01") return respuesta({ codigo: "conflicto_concurrente" }, 409);
  return respuesta({ codigo: "error_interno" }, 500);
}
function protegido(accion: string, manejador: Manejador) {
  return conAcceso({ accion }, async (req, ctx, inv) => {
    try { return await manejador(req, ctx, inv); }
    catch (error) {
      if (error instanceof ErrorAplicacion && error.estado === 403) await auditar(ctx, { accion, resultado: "denegado" });
      return traducirError(error);
    }
  });
}
export async function manejarAcceso(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const ruta = new URL(req.url).pathname.replace(/\/$/, "");
    if (ruta.endsWith("/equipo/activar")) {
      const datos = await validarCuerpo(req, z.object({ token, dispositivoId: uuid }).strict());
      return respuesta(await entrar(datos.token, "equipo", datos.dispositivoId));
    }
    if (ruta.endsWith("/familia/entrar")) {
      const datos = await validarCuerpo(req, z.object({ token }).strict());
      return respuesta(await entrar(datos.token, "familia"));
    }
    if (ruta.endsWith("/renovar")) {
      const datos = await validarCuerpo(req, z.object({ tokenRenovacion: token, dispositivoId: uuid, pendientes: z.number().int().min(0).max(1000000).optional() }).strict());
      return respuesta(await renovar(datos.tokenRenovacion, datos.dispositivoId, datos.pendientes));
    }
    if (ruta.endsWith("/bloqueo")) {
      const datos = await validarCuerpo(req, z.object({ tokenRenovacion: token, dispositivoId: uuid }).strict());
      await reportarBloqueo(datos.tokenRenovacion, datos.dispositivoId);
      return respuesta({ bloqueada: true });
    }
    return respuesta({ codigo: "acceso_denegado" }, 401);
  } catch (error) { return traducirError(error); }
}
export const manejadoresSeguridad = {
  yo: protegido("yo:leer", async (_req, ctx) => respuesta({ ...ctx, rolesEfectivos: rolesEfectivos(ctx) })),
  crearCuenta: protegido("cuentas:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, altaCuenta);
    const creada = await crearCuenta(datos, ctx);
    return respuesta({ id: datos.id }, creada ? 201 : 200);
  }),
  listarCuentas: protegido("cuentas:gestionar", async (_req, ctx) => respuesta({ cuentas: await listarCuentas(ctx) })),
  leerCuenta: protegido("cuentas:gestionar", async (req, ctx) => respuesta((await listarCuentas(ctx, id(req)))[0])),
  roles: protegido("cuentas:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, z.object({ roles }).strict());
    await reemplazarRoles(id(req), datos.roles, ctx);
    return respuesta({ actualizado: true });
  }),
  desactivar: protegido("cuentas:gestionar", async (req, ctx) => {
    await validarCuerpo(req, z.object({}).strict());
    await desactivarCuenta(id(req), ctx);
    return respuesta({ desactivada: true });
  }),
  identidadReal: protegido("identidad-real:leer", async (req, ctx) => enTransaccion(async tx => {
    const objetivo = id(req);
    const fila = (await tx.query<{ nombres: string; apellidos: string; fechaNacimiento: string | null }>('SELECT nombres,apellidos,fecha_nacimiento::text "fechaNacimiento" FROM leer_identidad_real($1,$2)', [ctx.cuentaId, objetivo])).rows[0];
    await auditar(ctx, { accion: "identidad-real:leer", recursoTipo: "cuenta", recursoId: objetivo, resultado: "permitido" }, tx);
    return respuesta(fila ?? null);
  })),
  emitirEnlace: protegido("cuentas:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, z.object({ tipo: z.enum(["equipo", "familia"]) }).strict());
    const resultado = await emitirEnlace(id(req), datos.tipo, undefined, ctx);
    return respuesta({ url: resultado.url }, 201);
  }),
  revocarEnlace: protegido("cuentas:gestionar", async (req, ctx) => {
    await validarCuerpo(req, z.object({}).strict());
    await revocarEnlace(id(req), "revocacion", undefined, ctx);
    return respuesta({ revocada: true });
  }),
  listarDelegaciones: protegido("delegacion:gestionar", async (_req, ctx) => {
    const filas = await consultar(`SELECT d.id,d.delegante_id "deleganteId",d.delegado_id "delegadoId",a.identidad_operativa "deleganteVisible",b.identidad_operativa "delegadoVisible",d.desde,d.hasta,d.revocada_en "revocadaEn" FROM delegacion d JOIN cuenta a ON a.id=d.delegante_id JOIN cuenta b ON b.id=d.delegado_id WHERE ($1 OR d.delegante_id=$2) ORDER BY d.creada_en DESC LIMIT 500`, [ctx.rolesPropios.includes("administracion"), ctx.cuentaId]);
    return respuesta({ delegaciones: filas.rows });
  }),
  crearDelegacion: protegido("delegacion:gestionar", async (req, ctx) => {
    const datos = await validarCuerpo(req, z.object({ id: uuid, delegadoId: uuid, desde: z.string().datetime({ offset: true }), hasta: z.string().datetime({ offset: true }) }).strict());
    return respuesta({ id: datos.id }, await crearDelegacion(datos, ctx) ? 201 : 200);
  }),
  revocarDelegacion: protegido("delegacion:gestionar", async (req, ctx) => {
    await validarCuerpo(req, z.object({}).strict());
    await revocarDelegacion(id(req), ctx);
    return respuesta({ revocada: true });
  }),
  textoConsentimiento: protegido("consentimiento:registrar", async () => {
    const filas = await consultar('SELECT id,version,contenido,encode(contenido_sha256,\'hex\') "contenidoSha256",incluye_clausula_constancia "incluyeClausulaConstancia",vigente_desde "vigenteDesde" FROM texto_consentimiento WHERE vigente_desde<=now() ORDER BY vigente_desde DESC,version DESC LIMIT 1');
    return respuesta(filas.rows[0] ?? null);
  }),
  registrarConsentimiento: protegido("consentimiento:registrar", async (req, ctx) => {
    const datos = await validarCuerpo(req, esquemaConsentimiento);
    const resultado = await enTransaccion(tx => registrarConsentimiento(tx, datos, ctx));
    return respuesta({ id: resultado.id }, resultado.creado ? 201 : 200);
  }),
  retirarConsentimiento: protegido("consentimiento:retirar", async (req, ctx) => {
    await validarCuerpo(req, z.object({}).strict());
    return respuesta(await retirarConsentimiento(id(req), ctx));
  }),
  auditoria: protegido("auditoria:leer", async (req, ctx) => {
    const esquema = z.object({ catequizandoId: uuid.optional(), desde: z.string().datetime({ offset: true }).optional(), hasta: z.string().datetime({ offset: true }).optional() }).strict();
    const datos = esquema.safeParse(Object.fromEntries(req.query));
    if (!datos.success) throw new ErrorAplicacion(422, "entrada_invalida");
    const filas = await consultar(`SELECT e.id,e.ocurrido_en "ocurridoEn",e.cuenta_id "cuentaId",c.identidad_operativa "autorVisible",e.accion,e.recurso_tipo "recursoTipo",e.recurso_id "recursoId",e.catequizando_id "catequizandoId",e.resultado,e.detalle FROM evento_auditoria e LEFT JOIN cuenta c ON c.id=e.cuenta_id WHERE ($1::uuid IS NULL OR e.catequizando_id=$1) AND ($2::timestamptz IS NULL OR e.ocurrido_en>=$2) AND ($3::timestamptz IS NULL OR e.ocurrido_en<=$3) ORDER BY e.ocurrido_en DESC,e.id LIMIT 500`, [datos.data.catequizandoId ?? null, datos.data.desde ?? null, datos.data.hasta ?? null]);
    await auditar(ctx, { accion: "auditoria:leer", resultado: "permitido" });
    return respuesta({ eventos: filas.rows });
  }),
  avisosCoordinacion: protegido("avisos-coordinacion:leer", async () => {
    const filas = await consultar(`SELECT a.id,a.tipo,a.cuenta_relacionada_id "cuentaRelacionadaId",c.identidad_operativa "identidadOperativa",a.cantidad,a.creado_en "creadoEn",a.leido_en "leidoEn" FROM aviso_coordinacion a JOIN cuenta c ON c.id=a.cuenta_relacionada_id ORDER BY a.creado_en DESC LIMIT 500`);
    return respuesta({ avisos: filas.rows });
  }),
  leerAviso: protegido("avisos-coordinacion:leer", async (req, ctx) => {
    await validarCuerpo(req, z.object({}).strict());
    await enTransaccion(async tx => {
      await tx.query("UPDATE aviso_coordinacion SET leido_en=COALESCE(leido_en,now()),leido_por=COALESCE(leido_por,$2) WHERE id=$1", [id(req), ctx.cuentaId]);
      await auditar(ctx, { accion: "avisos-coordinacion:leido", recursoTipo: "aviso_coordinacion", recursoId: id(req), resultado: "permitido" }, tx);
    });
    return respuesta({ leido: true });
  }),
};
export async function retencionDiaria(): Promise<void> {
  const ciclos = await consultar<{ id: string }>("SELECT c.id FROM ciclo c WHERE c.estado='cerrado' AND c.cerrado_en+interval '2 years'<=now() AND NOT EXISTS(SELECT 1 FROM ejecucion_retencion e WHERE e.tipo='vencimiento_ciclo' AND e.objetivo_id=c.id AND e.completada_en IS NOT NULL)");
  for (const ciclo of ciclos.rows) await vencerCiclo(ciclo.id);
}
export function registrarSeguridad(): void {
  for (const [nombre, ruta] of [["activarEquipo", "acceso/equipo/activar"], ["entrarFamilia", "acceso/familia/entrar"], ["renovarSesion", "acceso/renovar"], ["reportarBloqueo", "acceso/bloqueo"]] as const) app.http(nombre, { route: ruta, methods: ["POST"], authLevel: "function", handler: manejarAcceso });
  const rutas = [
    ["yo", "GET", "yo"], ["crearCuenta", "POST", "cuentas"], ["listarCuentas", "GET", "cuentas"], ["leerCuenta", "GET", "cuentas/{id}"],
    ["roles", "PUT", "cuentas/{id}/roles"], ["desactivar", "POST", "cuentas/{id}/desactivar"], ["identidadReal", "GET", "cuentas/{id}/identidad-real"],
    ["emitirEnlace", "POST", "cuentas/{id}/enlaces"], ["revocarEnlace", "POST", "cuentas/{id}/enlaces/revocar"],
    ["listarDelegaciones", "GET", "delegaciones"], ["crearDelegacion", "POST", "delegaciones"], ["revocarDelegacion", "POST", "delegaciones/{id}/revocar"],
    ["textoConsentimiento", "GET", "consentimientos/texto-vigente"], ["registrarConsentimiento", "POST", "consentimientos"], ["retirarConsentimiento", "POST", "consentimientos/{id}/retirar"],
    ["auditoria", "GET", "auditoria"], ["avisosCoordinacion", "GET", "avisos-coordinacion"], ["leerAviso", "POST", "avisos-coordinacion/{id}/leido"],
  ] as const;
  for (const [nombre, metodo, ruta] of rutas) app.http(nombre, { route: ruta, methods: [metodo], authLevel: "function", handler: manejadoresSeguridad[nombre] });
  app.timer("retencionDiaria", { schedule: "0 0 8 * * *", handler: retencionDiaria });
  app.timer("borradosPendientes", { schedule: "0 */15 * * * *", handler: async () => { await borrarBlobsPendientes(); } });
  app.timer("purgaAuditoria", { schedule: "0 0 9 1 * *", handler: async () => { await consultar("SELECT purgar_auditoria(now()-interval '730 days')"); } });
}
