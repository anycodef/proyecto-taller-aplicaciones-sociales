import { z } from "zod";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { MAXIMO_FOTOS, validarMetadatos } from "@/lib/justificaciones/evidencia";
import { ausenciasJustificables, sesionesAnticipables } from "@/lib/justificaciones/justificables";
import { expandirLote, validarLote, type MotivoLoteInvalido } from "@/lib/justificaciones/lote";
import { puedeJustificar, puedeRegistrarEnNombre } from "@/lib/justificaciones/permisos";
import type { AusenciaRef, Canal, EntradaLote, ItemLote, Justificacion } from "@/lib/justificaciones/tipos";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { nombreBlob, notificarCambioJustificacion, type AlmacenEvidencias, type ArchivoGuardado } from "../dominio/puertos";
import { repositorioEvidenciasPg as evidencias } from "../infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg as repo } from "../infraestructura/repositorio-justificaciones-pg";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { ausenciasDeHijos, contextoFamilia, justificacionesDeHijos, sesionesFuturas, type ContextoFamilia } from "./familia";

export const esquemaLote = z.object({
  loteId: z.string().uuid(),
  evidenciaId: z.string().uuid(),
  causa: z.string().max(40),
  /** Solo la coordinación: registra en nombre de este apoderado (RF-406). */
  apoderadoId: z.string().uuid().optional(),
  ausencias: z.array(z.object({ justificacionId: z.string().uuid(), catequizandoId: z.string().uuid(), sesionId: z.string().uuid(), anticipada: z.boolean() }).strict()).min(1).max(60),
}).strict();
export type EntradaLoteHttp = z.infer<typeof esquemaLote>;
export type ResultadoLote = { creado: boolean; justificaciones: Justificacion[] };

const ESTADO_POR_MOTIVO: Partial<Record<MotivoLoteInvalido, number>> = { nino_ajeno: 403 };

/** Verifica cada archivo subido: existe, pesa hasta 300 KB, es JPEG por su firma y no solo por su content-type (RNF-402). */
async function inspeccionarEvidencia(almacen: AlmacenEvidencias, cicloId: string, evidenciaId: string): Promise<ArchivoGuardado[] | undefined> {
  const archivos: ArchivoGuardado[] = [];
  for (let orden = 1; orden <= MAXIMO_FOTOS; orden += 1) {
    const blobNombre = nombreBlob(cicloId, evidenciaId, orden);
    const inspeccion = await almacen.inspeccionar(blobNombre);
    if (!inspeccion) break;
    if (!inspeccion.firmaJpeg) return undefined;
    archivos.push({ orden, blobNombre, bytes: inspeccion.bytes, contentType: inspeccion.contentType });
  }
  return validarMetadatos(archivos).valida ? archivos : undefined;
}

/** Hijos con vínculo vigente: la coordinación solo registra para niños de ese apoderado. */
export async function hijosDelApoderado(apoderadoId: string, tx: Tx): Promise<string[]> {
  const filas = await tx.query<{ catequizando_id: string }>(
    "SELECT DISTINCT catequizando_id FROM vinculo_apoderado WHERE apoderado_id=$1 AND vigente_desde<=now() AND (vigente_hasta IS NULL OR vigente_hasta>now()) ORDER BY catequizando_id", [apoderadoId]);
  return filas.rows.map(f => f.catequizando_id);
}

async function contextoDelEnvio(entrada: EntradaLoteHttp, ctx: ContextoAcceso, ahora: Date, tx: Tx): Promise<{ familia: ContextoFamilia; canal: Canal }> {
  if (!entrada.apoderadoId) {
    for (const a of entrada.ausencias) if (!puedeJustificar(ctx, a.catequizandoId)) throw new ErrorAplicacion(403, "fuera_de_alcance");
    return { familia: await contextoFamilia(ctx, tx), canal: "enlace" };
  }
  // El mismo plazo que la familia rige también para la coordinación (supuesto A-04).
  if (!puedeRegistrarEnNombre(ctx, ahora)) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  const hijos = await hijosDelApoderado(entrada.apoderadoId, tx);
  if (entrada.ausencias.some(a => !hijos.includes(a.catequizandoId))) throw new ErrorAplicacion(400, "apoderado_ajeno");
  return { familia: { cicloId, apoderadoId: entrada.apoderadoId, hijos }, canal: "coordinacion" };
}

/**
 * Una evidencia, una justificación por ausencia, en una transacción (RF-403).
 * El tipo y la fecha de cada sesión los pone el servidor, no el cliente.
 */
export async function crearLote(entrada: EntradaLoteHttp, ctx: ContextoAcceso, almacen: AlmacenEvidencias, ahora: Date, tx: Tx): Promise<ResultadoLote> {
  const previo = await repo.obtenerLote(tx, entrada.loteId);
  if (previo.length) {
    const mismos = previo.every(j => j.evidenciaId === entrada.evidenciaId) && entrada.ausencias.every(a => previo.some(j => j.id === a.justificacionId));
    if (!mismos) throw new ErrorAplicacion(409, "lote_en_conflicto");
    return { creado: false, justificaciones: previo };
  }
  const { familia, canal } = await contextoDelEnvio(entrada, ctx, ahora, tx);
  const evidencia = await evidencias.obtener(tx, entrada.evidenciaId);
  if (!evidencia || evidencia.estado !== "reservada" || evidencia.subidaPor !== ctx.cuentaId || evidencia.cicloId !== familia.cicloId) throw new ErrorAplicacion(409, "evidencia_no_reservada");

  const { diasPlazo } = await repo.obtenerPlazo(tx, familia.cicloId);
  const justificaciones = await justificacionesDeHijos(familia.hijos, tx);
  const justificables = ausenciasJustificables(await ausenciasDeHijos(familia.cicloId, familia.hijos, ahora, tx), justificaciones, diasPlazo, ahora);
  const anticipables = sesionesAnticipables({ sesiones: await sesionesFuturas(familia.cicloId, ahora, tx), catequizandoIds: familia.hijos, justificaciones, cicloId: familia.cicloId, ahora });
  const conocida = (a: EntradaLoteHttp["ausencias"][number]): AusenciaRef | undefined =>
    (a.anticipada ? anticipables : justificables).find(r => r.catequizandoId === a.catequizandoId && r.sesionId === a.sesionId);
  const items: ItemLote[] = [];
  for (const a of entrada.ausencias) {
    const ref = conocida(a);
    if (!ref) throw new ErrorAplicacion(400, "no_justificable");
    items.push({ ...ref, justificacionId: a.justificacionId, anticipada: a.anticipada });
  }

  const archivos = await inspeccionarEvidencia(almacen, familia.cicloId, entrada.evidenciaId);
  if (!archivos) {
    await almacen.borrarPrefijo(`${familia.cicloId}/${entrada.evidenciaId}/`);
    throw new ErrorAplicacion(400, "evidencia_invalida");
  }
  const lote: EntradaLote = {
    loteId: entrada.loteId, cicloId: familia.cicloId, causa: entrada.causa, evidenciaId: entrada.evidenciaId,
    cantidadFotos: archivos.length, apoderadoId: familia.apoderadoId, canal, ausencias: items,
    ...(canal === "coordinacion" ? { registradaPor: ctx.cuentaId } : {}),
  };
  const validacion = validarLote(lote, { hijosDelApoderado: familia.hijos, justificables, anticipables });
  if (!validacion.valido) throw new ErrorAplicacion(ESTADO_POR_MOTIVO[validacion.motivo] ?? 400, validacion.motivo);

  if (!(await evidencias.confirmar(tx, entrada.evidenciaId, archivos, ahora))) throw new ErrorAplicacion(409, "evidencia_no_reservada");
  const guardadas = await repo.insertarLote(tx, expandirLote(lote, ahora.toISOString()), ctx.cuentaId);
  await notificarCambioJustificacion(guardadas, tx);
  return { creado: true, justificaciones: guardadas };
}
