import { z } from "zod";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { estadoVisible, revisar } from "@/lib/justificaciones/estados";
import { ausenciasJustificables } from "@/lib/justificaciones/justificables";
import { fechaLimite, validarDiasPlazo } from "@/lib/justificaciones/plazo";
import { ErrorJustificacion, type Justificacion } from "@/lib/justificaciones/tipos";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { asegurarCicloAbierto, cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { auditar } from "../../seguridad";
import { notificarCambioJustificacion, type AlmacenEvidencias, type PlazoCiclo } from "../dominio/puertos";
import { repositorioEvidenciasPg as evidencias } from "../infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg as repo } from "../infraestructura/repositorio-justificaciones-pg";
import { ausenciasDeHijos } from "./familia";

const ESTADO_ERROR_DOMINIO: Record<string, number> = { motivo_requerido: 400, motivo_largo: 400, plazo_invalido: 400, no_pendiente: 409, sin_efecto: 409 };
/** Traduce los errores del dominio puro al estado HTTP. */
export function comoErrorAplicacion(error: unknown): never {
  if (error instanceof ErrorJustificacion) throw new ErrorAplicacion(ESTADO_ERROR_DOMINIO[error.codigo] ?? 400, error.codigo);
  throw error;
}

export async function consultarPlazo(cicloId: string, tx: Tx): Promise<PlazoCiclo> {
  const existe = await tx.query("SELECT 1 FROM ciclo WHERE id=$1", [cicloId]);
  if (!existe.rowCount) throw new ErrorAplicacion(404, "no_encontrado");
  return repo.obtenerPlazo(tx, cicloId);
}

export const esquemaPlazo = z.object({ diasPlazo: z.number() }).strict();

/** El cambio de plazo queda en la auditoría de 001 (RF-405). */
export async function definirPlazo(cicloId: string, diasPlazo: number, ctx: ContextoAcceso, ahora: Date, tx: Tx): Promise<PlazoCiclo> {
  try { validarDiasPlazo(diasPlazo); } catch (error) { comoErrorAplicacion(error); }
  await asegurarCicloAbierto(tx, cicloId);
  const plazo = await repo.definirPlazo(tx, cicloId, diasPlazo, ctx.cuentaId, ahora);
  await auditar(ctx, { accion: "justificacion:configurar-plazo", recursoTipo: "ciclo", recursoId: cicloId, resultado: "permitido", detalle: { cantidad: diasPlazo } }, tx);
  return plazo;
}

export async function consultarBandeja(tx: Tx) {
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  const lotes = await repo.bandeja(tx, cicloId);
  const ninos = new Set(lotes.flatMap(l => l.justificaciones.map(j => j.catequizandoId)));
  const nombres = await tx.query<{ id: string; nombres: string; apellidos: string }>("SELECT id,nombres,apellidos FROM catequizando WHERE id=ANY($1::uuid[])", [[...ninos]]);
  const nombre = new Map(nombres.rows.map(f => [f.id, `${f.nombres} ${f.apellidos}`.trim()]));
  return {
    cicloId,
    lotes: lotes.map(l => ({
      loteId: l.loteId,
      evidenciaId: l.justificaciones[0].evidenciaId,
      causa: l.justificaciones[0].causa,
      canal: l.justificaciones[0].canal,
      enviadaEn: l.justificaciones[0].enviadaEn,
      justificaciones: l.justificaciones.map(j => ({
        id: j.id, catequizandoId: j.catequizandoId, nombre: nombre.get(j.catequizandoId) ?? "", sesionId: j.sesionId, tipoSesion: j.tipoSesion,
        fecha: j.fecha, anticipada: j.anticipada, duplicada: j.duplicada,
      })),
    })),
  };
}

export const esquemaRevision = z.object({
  ids: z.array(z.string().uuid()).min(1).max(60),
  decision: z.enum(["aprobada", "rechazada"]),
  motivo: z.string().max(400).optional(),
}).strict();

/** Aprueba o rechaza juntas o por separado; todo o nada en la misma transacción (RF-403, RF-408). */
export async function revisarJustificaciones(entrada: z.infer<typeof esquemaRevision>, ctx: ContextoAcceso, ahora: Date, tx: Tx): Promise<{ id: string; estado: ReturnType<typeof estadoVisible> }[]> {
  const revisadas: Justificacion[] = [];
  for (const id of [...new Set(entrada.ids)]) {
    const j = await repo.obtener(tx, id);
    if (!j) throw new ErrorAplicacion(404, "no_encontrado");
    await asegurarCicloAbierto(tx, j.cicloId);
    let resultado: Justificacion;
    try { resultado = revisar(j, entrada.decision, ctx.cuentaId, ahora.toISOString(), entrada.motivo); } catch (error) { comoErrorAplicacion(error); }
    await repo.guardarRevision(tx, resultado).catch(comoErrorAplicacion);
    revisadas.push(resultado);
  }
  await notificarCambioJustificacion(revisadas, tx);
  return revisadas.map(j => ({ id: j.id, estado: estadoVisible(j) }));
}

export async function catequizandoDeJustificacion(id: string, tx: Tx): Promise<string | undefined> {
  return (await tx.query<{ catequizando_id: string }>("SELECT catequizando_id FROM justificacion WHERE id=$1", [id])).rows[0]?.catequizando_id;
}

/** SAS de lectura nueva en cada consulta y registro en la auditoría (RNF-403). */
export async function obtenerEvidencia(justificacionId: string, ctx: ContextoAcceso, almacen: AlmacenEvidencias, ahora: Date, tx: Tx) {
  const j = await repo.obtener(tx, justificacionId);
  if (!j) throw new ErrorAplicacion(404, "no_encontrado");
  const evidencia = await evidencias.obtener(tx, j.evidenciaId);
  await auditar(ctx, { accion: "evidencia:leer", recursoTipo: "justificacion", recursoId: j.id, catequizandoId: j.catequizandoId, resultado: "permitido" }, tx);
  if (!evidencia || evidencia.estado !== "confirmada" || !evidencia.archivos.length) throw new ErrorAplicacion(410, "sin_evidencia");
  const archivos: { orden: number; url: string }[] = [];
  let expiraEn = "";
  for (const archivo of evidencia.archivos) {
    const firmada = await almacen.urlLectura(archivo.blobNombre, ahora);
    archivos.push({ orden: archivo.orden, url: firmada.url });
    expiraEn = firmada.expiraEn;
  }
  return { justificacionId: j.id, evidenciaId: evidencia.id, expiraEn, archivos };
}

/** Historial del perfil: el equipo solo ve la identidad operativa de quien registró o revisó. */
export async function historialCatequizando(catequizandoId: string, tx: Tx) {
  const lista = await repo.listarPorCatequizando(tx, catequizandoId);
  const cuentas = [...new Set(lista.flatMap(j => [j.registradaPor, j.revisadaPor]).filter((c): c is string => !!c))];
  const apoderados = [...new Set(lista.map(j => j.enviadaPor))];
  const identidades = await tx.query<{ id: string; identidad_operativa: string }>("SELECT id,identidad_operativa FROM cuenta WHERE id=ANY($1::uuid[])", [cuentas]);
  const nombresApoderado = await tx.query<{ id: string; nombre: string }>("SELECT id,trim(nombres || ' ' || apellidos) AS nombre FROM apoderado WHERE id=ANY($1::uuid[])", [apoderados]);
  const identidad = new Map(identidades.rows.map(f => [f.id, f.identidad_operativa]));
  const apoderado = new Map(nombresApoderado.rows.map(f => [f.id, f.nombre]));
  return {
    catequizandoId,
    justificaciones: lista.map(j => ({
      id: j.id, loteId: j.loteId, sesionId: j.sesionId, tipoSesion: j.tipoSesion, fecha: j.fecha, causa: j.causa, anticipada: j.anticipada,
      estado: estadoVisible(j), motivoRechazo: j.motivoRechazo, enviadaEn: j.enviadaEn,
      enviadaPor: { apoderadoId: j.enviadaPor, nombre: apoderado.get(j.enviadaPor) ?? "" },
      canal: j.canal,
      registradaPor: j.registradaPor ? identidad.get(j.registradaPor) ?? null : null, registradaEn: j.registradaEn,
      revisadaPor: j.revisadaPor ? identidad.get(j.revisadaPor) ?? null : null, revisadaEn: j.revisadaEn,
    })),
  };
}

/** Para registrar en nombre de: ausencias del niño con plazo vigente y sus apoderados vigentes (RF-406). */
export async function justificablesParaCoordinacion(catequizandoId: string, ahora: Date, tx: Tx) {
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  const nino = await tx.query<{ nombres: string; apellidos: string }>("SELECT nombres,apellidos FROM catequizando WHERE id=$1", [catequizandoId]);
  if (!nino.rows[0]) throw new ErrorAplicacion(404, "no_encontrado");
  const { diasPlazo } = await repo.obtenerPlazo(tx, cicloId);
  const ausencias = ausenciasJustificables(await ausenciasDeHijos(cicloId, [catequizandoId], ahora, tx), await repo.listarPorCatequizando(tx, catequizandoId), diasPlazo, ahora);
  const apoderados = await tx.query<{ id: string; nombre: string; relacion: string }>(`SELECT a.id,trim(a.nombres || ' ' || a.apellidos) AS nombre,v.relacion FROM vinculo_apoderado v JOIN apoderado a ON a.id=v.apoderado_id
    WHERE v.catequizando_id=$1 AND v.vigente_desde<=now() AND (v.vigente_hasta IS NULL OR v.vigente_hasta>now()) ORDER BY nombre,a.id`, [catequizandoId]);
  return {
    cicloId,
    diasPlazo,
    nino: { catequizandoId, nombre: `${nino.rows[0].nombres} ${nino.rows[0].apellidos}`.trim() },
    apoderados: apoderados.rows.map(f => ({ apoderadoId: f.id, nombre: f.nombre, relacion: f.relacion })),
    ausencias: ausencias.map(a => ({ ...a, venceEn: fechaLimite(a.fecha, diasPlazo) })),
  };
}
