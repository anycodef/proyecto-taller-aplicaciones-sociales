import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { z } from "zod";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { fechaValida } from "@/lib/asistencia/sesiones";
import { conAcceso } from "../../../compartido/http/con-acceso";
import { limitarPorCuenta } from "../../../compartido/http/limites";
import { recursoCatequizando } from "../../../compartido/http/recursos";
import { respuesta, ErrorAplicacion } from "../../../compartido/http/respuestas";
import { validarCuerpo } from "../../../compartido/http/validar-cuerpo";
import { consultar } from "../../../compartido/bd/pool";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { resolverCarneServidor } from "../infraestructura/repositorio-pg";
import { reporteMisa } from "../aplicacion/reporte-misa";
import { consultarResumenAsistencia } from "../aplicacion/consultar-faltas";
import { generarSesionesDominicales, crearSesionActividad } from "../aplicacion/generar-sesiones";
const uuid = z.string().uuid();
export function validarId(valor: unknown): string {
  const resultado = uuid.safeParse(valor);
  if (!resultado.success) throw new ErrorAplicacion(422, "entrada_invalida");
  return resultado.data;
}
export function traducirErrorAsistencia(error: unknown): HttpResponseInit {
  if (error instanceof ErrorAplicacion) return respuesta({ codigo: error.codigo }, error.estado);
  return respuesta({ codigo: "error_interno" }, 500);
}
type Manejador = (req: HttpRequest, ctx: ContextoAcceso, inv: InvocationContext) => Promise<HttpResponseInit>;
function protegido(accion: string, ruta: string, manejador: Manejador, recurso?: (req: HttpRequest) => Promise<{ catequizandoId?: string; grupoId?: string }>, max = 30) {
  return conAcceso({ accion, recurso }, async (req, ctx, inv) => {
    try { await limitarPorCuenta(ctx.cuentaId, ruta, max, 60); return await manejador(req, ctx, inv); }
    catch (error) { return traducirErrorAsistencia(error); }
  });
}
export const manejadoresAsistencia = {
  validarCarne: protegido("asistencia:escanear", "asistencia:validacion", async (req) => {
    const codigo = req.params.codigo;
    if (!codigo || codigo.length > 200) throw new ErrorAplicacion(422, "entrada_invalida");
    return enTransaccion(async tx => respuesta({ estado: (await resolverCarneServidor(codigo, tx)).estado }));
  }, undefined, 120),
  reporteMisa: protegido("reporte:leer", "asistencia:reporte", async req => {
    const fecha = req.params.fecha;
    if (!fecha || !fechaValida(fecha)) throw new ErrorAplicacion(422, "entrada_invalida");
    return respuesta(await reporteMisa(fecha));
  }),
  listarAvisos: protegido("asistencia:avisos", "asistencia:avisos", async req => {
    const estado = z.enum(["abierto", "atendido"]).safeParse(req.query.get("estado") ?? "abierto");
    if (!estado.success) throw new ErrorAplicacion(422, "entrada_invalida");
    const resultado = await consultar<{ id: string; tipo: string; sesion_id: string; catequizando_id: string | null; marca_id: string | null; detalle: unknown; estado: string; atendido_en: Date | null; identidad_operativa: string | null }>(`SELECT a.id,a.tipo,a.sesion_id,a.catequizando_id,a.marca_id,a.detalle,a.estado,a.atendido_en,c.identidad_operativa
      FROM aviso_asistencia a JOIN ciclo ci ON ci.id=a.ciclo_id AND ci.estado='abierto' LEFT JOIN cuenta c ON c.id=a.atendido_por
      WHERE a.estado=$1 AND a.eliminado_en IS NULL ORDER BY a.actualizado_en,a.id LIMIT 1000`, [estado.data]);
    return respuesta(resultado.rows.map(fila => ({ id: fila.id, tipo: fila.tipo, sesionId: fila.sesion_id, catequizandoId: fila.catequizando_id, marcaId: fila.marca_id, detalle: fila.detalle, estado: fila.estado, atendidoEn: fila.atendido_en?.toISOString() ?? null, atendidoPor: fila.identidad_operativa })));
  }),
  atenderAviso: protegido("asistencia:avisos", "asistencia:atencion", async (req, ctx) => {
    const id = validarId(req.params.id);
    const texto = await req.text();
    if (texto) {
      try { z.object({}).strict().parse(JSON.parse(texto)); }
      catch { throw new ErrorAplicacion(422, "entrada_invalida"); }
    }
    const resultado = await consultar("UPDATE aviso_asistencia SET estado='atendido',atendido_por=COALESCE(atendido_por,$2),atendido_en=COALESCE(atendido_en,clock_timestamp()) WHERE id=$1 AND eliminado_en IS NULL AND ciclo_id IN (SELECT id FROM ciclo WHERE estado='abierto') RETURNING id", [id, ctx.cuentaId]);
    if (!resultado.rowCount) throw new ErrorAplicacion(404, "aviso_no_disponible");
    return respuesta({ atendido: true });
  }),
  domingos: protegido("asistencia:leer", "asistencia:domingos", async req => {
    const catequizandoId = validarId(req.params.id);
    const solicitado = req.query.get("cicloId");
    const ciclo = solicitado ? validarId(solicitado) : (await consultar<{ id: string }>("SELECT id FROM ciclo WHERE estado='abierto' LIMIT 1")).rows[0]?.id;
    return respuesta(ciclo ? await consultarResumenAsistencia(catequizandoId, ciclo) : { domingos: [], ausencias: 0, faltas: 0 });
  }, req => recursoCatequizando(validarId(req.params.id))),
  crearActividad: protegido("actividad:gestionar", "asistencia:actividad", async req => {
    const datos = await validarCuerpo(req, z.object({ actividadId: uuid }).strict());
    return respuesta({ sesionId: await crearSesionActividad(datos.actividadId) }, 201);
  }),
};
let registrada = false;
export function registrarAsistencia(): void {
  if (registrada) return;
  registrada = true;
  app.http("validarCarne", { methods: ["GET"], authLevel: "function", route: "asistencia/carnes/{codigo}/validacion", handler: manejadoresAsistencia.validarCarne });
  app.http("reporteMisa", { methods: ["GET"], authLevel: "function", route: "asistencia/misas/{fecha}/reporte", handler: manejadoresAsistencia.reporteMisa });
  app.http("listarAvisosAsistencia", { methods: ["GET"], authLevel: "function", route: "asistencia/avisos", handler: manejadoresAsistencia.listarAvisos });
  app.http("atenderAvisoAsistencia", { methods: ["POST"], authLevel: "function", route: "asistencia/avisos/{id}/atencion", handler: manejadoresAsistencia.atenderAviso });
  app.http("asistenciaDeCatequizando", { methods: ["GET"], authLevel: "function", route: "asistencia/catequizandos/{id}/domingos", handler: manejadoresAsistencia.domingos });
  app.http("crearSesionActividad", { methods: ["POST"], authLevel: "function", route: "asistencia/actividades/sesiones", handler: manejadoresAsistencia.crearActividad });
  app.timer("generarSesionesDominicales", { schedule: "0 0 8 * * 1", handler: async () => { await generarSesionesDominicales(); } });
  app.timer("precalentarDomingo", { schedule: "0 */5 12-16 * * 0", handler: async () => { await consultar("SELECT 1"); } });
}
