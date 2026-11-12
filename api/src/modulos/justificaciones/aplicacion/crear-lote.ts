import { expandirLote, validarLote, type MotivoLoteInvalido } from "@/lib/justificaciones/lote";
import { estadoVisible } from "@/lib/justificaciones/estados";
import { CONTENT_TYPE_EVIDENCIA, LIMITE_BYTES, MAXIMO_FOTOS } from "@/lib/justificaciones/evidencia";
import { ErrorJustificacion, type AusenciaRef, type EstadoVisible, type ItemLote, type Justificacion } from "@/lib/justificaciones/tipos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { nombreBlob, type AlmacenEvidencias, type ArchivoGuardado } from "../dominio/puertos";
import { repositorioEvidenciasPg } from "../infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg } from "../infraestructura/repositorio-justificaciones-pg";
import { ausenciasJustificablesDe } from "./familia";

export type EntradaCrearLote = {
  loteId: string;
  causa: string;
  evidenciaId: string;
  ausencias: { catequizandoId: string; sesionId: string; justificacionId: string }[];
};
export type ResultadoLote = { loteId: string; justificaciones: { id: string; catequizandoId: string; sesionId: string; fecha: string; tipoSesion: Justificacion["tipoSesion"]; estadoVisible: EstadoVisible }[] };

const resumir = (loteId: string, justificaciones: readonly Justificacion[]): ResultadoLote => ({
  loteId,
  // Mismo orden al crear y al reenviar, para que la respuesta idempotente sea idéntica.
  justificaciones: [...justificaciones]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.catequizandoId.localeCompare(b.catequizandoId) || a.sesionId.localeCompare(b.sesionId))
    .map((j) => ({ id: j.id, catequizandoId: j.catequizandoId, sesionId: j.sesionId, fecha: j.fecha, tipoSesion: j.tipoSesion, estadoVisible: estadoVisible(j) })),
});

const estadoDeMotivo = (motivo: MotivoLoteInvalido): number => (motivo === "nino_ajeno" ? 403 : 422);

/** Una evidencia, una justificación por ausencia (RF-403); reenviar el mismo lote devuelve lo ya guardado (D-413). */
export async function crearLote(ctx: ContextoAcceso, entrada: EntradaCrearLote, almacen: AlmacenEvidencias, ahora: Date, tx: Tx): Promise<ResultadoLote> {
  const ids = entrada.ausencias.map((a) => a.justificacionId);
  const previas = (await Promise.all(ids.map((id) => repositorioJustificacionesPg.obtener(tx, id)))).filter((j): j is Justificacion => j !== undefined);
  if (previas.length) {
    const mismoLote = previas.length === ids.length && previas.every((j) => j.loteId === entrada.loteId && j.evidenciaId === entrada.evidenciaId);
    if (!mismoLote) throw new ErrorAplicacion(409, "lote_en_conflicto");
    const datos = await ausenciasJustificablesDe(ctx, ahora, tx);
    if (datos && previas.some((j) => j.enviadaPor !== datos.apoderadoId)) throw new ErrorAplicacion(403, "fuera_de_alcance");
    return resumir(entrada.loteId, previas);
  }

  const cicloId = await cicloAbierto(tx);
  if (!cicloId) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  const datos = await ausenciasJustificablesDe(ctx, ahora, tx);
  if (!datos) throw new ErrorAplicacion(403, "fuera_de_alcance");

  const evidencia = await repositorioEvidenciasPg.obtener(tx, entrada.evidenciaId);
  if (!evidencia || evidencia.subidaPor !== ctx.cuentaId) throw new ErrorAplicacion(404, "evidencia_no_encontrada");
  if (evidencia.estado !== "reservada") throw new ErrorAplicacion(409, "evidencia_no_reservada");

  const archivos: ArchivoGuardado[] = [];
  const invalidos: string[] = [];
  for (let orden = 1; orden <= MAXIMO_FOTOS; orden++) {
    const blobNombre = nombreBlob(evidencia.cicloId, evidencia.id, orden);
    const propiedades = await almacen.inspeccionar(blobNombre);
    if (!propiedades) continue;
    if (propiedades.contentType !== CONTENT_TYPE_EVIDENCIA || propiedades.bytes <= 0 || propiedades.bytes > LIMITE_BYTES) invalidos.push(blobNombre);
    else archivos.push({ orden, blobNombre, bytes: propiedades.bytes, contentType: propiedades.contentType });
  }
  if (invalidos.length) {
    await Promise.all([...invalidos, ...archivos.map((a) => a.blobNombre)].map((nombre) => almacen.borrar(nombre)));
    throw new ErrorAplicacion(422, "evidencia_invalida");
  }

  const conocidas = new Map<string, AusenciaRef>(datos.ausencias.map((a) => [`${a.catequizandoId}|${a.sesionId}`, a]));
  const items: ItemLote[] = entrada.ausencias.map((a) => {
    const conocida = conocidas.get(`${a.catequizandoId}|${a.sesionId}`);
    // Un marcador que `validarLote` rechaza: nunca se persiste una ausencia que el servidor no calculó.
    return { ...(conocida ?? { catequizandoId: a.catequizandoId, sesionId: a.sesionId, tipoSesion: "misa" as const, fecha: "1970-01-01" }), justificacionId: a.justificacionId, anticipada: false };
  });
  const entradaDominio = { loteId: entrada.loteId, cicloId, causa: entrada.causa, evidenciaId: evidencia.id, cantidadFotos: archivos.length, apoderadoId: datos.apoderadoId, canal: "enlace" as const, ausencias: items };
  const validacion = validarLote(entradaDominio, { hijosDelApoderado: ctx.catequizandosApoderados, justificables: datos.ausencias, anticipables: [] });
  if (!validacion.valido) throw new ErrorAplicacion(estadoDeMotivo(validacion.motivo), validacion.motivo);

  const nuevas = expandirLote(entradaDominio, ahora.toISOString());
  if (!(await repositorioEvidenciasPg.confirmar(tx, evidencia.id, archivos, ahora))) throw new ErrorAplicacion(409, "evidencia_no_reservada");
  try {
    return resumir(entrada.loteId, await repositorioJustificacionesPg.insertarLote(tx, nuevas, ctx.cuentaId));
  } catch (error) {
    if (error instanceof ErrorJustificacion) throw new ErrorAplicacion(409, error.codigo);
    throw error;
  }
}
