import { randomUUID } from "node:crypto";
import { CONTENT_TYPE_EVIDENCIA, LIMITE_BYTES, MAXIMO_FOTOS, validarMetadatos } from "@/lib/justificaciones/evidencia";
import { rolesEfectivos, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { permisoPara } from "@/lib/seguridad/matriz-permisos";
import { hoyEnLima } from "@/lib/seguridad/fechas";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { obtenerFuenteInscripciones } from "../../asistencia/infraestructura/fuente-inscripciones-pg";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { auditar } from "../../seguridad";
import { nombreBlob, type AlmacenEvidencias } from "../dominio/puertos";
import { repositorioEvidenciasPg } from "../infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg } from "../infraestructura/repositorio-justificaciones-pg";

export const RESERVAS_POR_HORA = 20;
const FIRMA_JPEG = [0xff, 0xd8, 0xff];

/** El cliente declara sus archivos para validar tamaño y cantidad antes de subir nada (RF-402, RNF-402). */
export async function reservarEvidencia(
  ctx: ContextoAcceso,
  archivos: readonly { bytes: number; contentType: string }[],
  ahora: Date,
  tx: Tx,
): Promise<{ evidenciaId: string; archivos: { orden: number }[] }> {
  const resultado = validarMetadatos(archivos);
  if (!resultado.valida) throw new ErrorAplicacion(400, resultado.motivo);
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  if ((await repositorioEvidenciasPg.contarReservasRecientes(tx, ctx.cuentaId, ahora)) >= RESERVAS_POR_HORA) {
    throw new ErrorAplicacion(429, "limite_excedido");
  }
  const evidenciaId = randomUUID();
  await repositorioEvidenciasPg.reservar(tx, { id: evidenciaId, cicloId, subidaPor: ctx.cuentaId, en: ahora });
  return { evidenciaId, archivos: archivos.map((_, i) => ({ orden: i + 1 })) };
}

/** Camino corto de hoy: la API escribe el blob tras verificar firma JPEG y tamaño (desviación D-402). */
export async function subirArchivo(
  ctx: ContextoAcceso,
  evidenciaId: string,
  orden: number,
  contenido: Buffer,
  contentType: string | null,
  almacen: AlmacenEvidencias,
  tx: Tx,
): Promise<{ orden: number; bytes: number }> {
  if (!Number.isInteger(orden) || orden < 1 || orden > MAXIMO_FOTOS) throw new ErrorAplicacion(400, "orden_invalido");
  if ((contentType ?? "").split(";")[0].trim().toLowerCase() !== CONTENT_TYPE_EVIDENCIA) throw new ErrorAplicacion(400, "tipo_no_permitido");
  if (contenido.length === 0 || contenido.length > LIMITE_BYTES) throw new ErrorAplicacion(400, "tamano_invalido");
  if (!FIRMA_JPEG.every((byte, i) => contenido[i] === byte)) throw new ErrorAplicacion(400, "firma_invalida");
  const evidencia = await repositorioEvidenciasPg.obtener(tx, evidenciaId);
  if (!evidencia || evidencia.subidaPor !== ctx.cuentaId) throw new ErrorAplicacion(404, "no_encontrada");
  if (evidencia.estado !== "reservada") throw new ErrorAplicacion(409, "evidencia_no_reservada");
  await almacen.subir(nombreBlob(evidencia.cicloId, evidencia.id, orden), contenido, CONTENT_TYPE_EVIDENCIA);
  return { orden, bytes: contenido.length };
}

/** Quien no tiene alcance de ciclo solo ve la evidencia de niños de sus grupos; cada consulta queda auditada (RNF-403). */
export async function obtenerLecturaEvidencia(
  ctx: ContextoAcceso,
  justificacionId: string,
  almacen: AlmacenEvidencias,
  ahora: Date,
  tx: Tx,
): Promise<{ url: string; urls: string[]; expiraEn: string }> {
  const justificacion = await repositorioJustificacionesPg.obtener(tx, justificacionId);
  if (!justificacion) throw new ErrorAplicacion(404, "no_encontrada");
  const permiso = permisoPara("evidencia:leer");
  const alcanceCiclo = rolesEfectivos(ctx).some((rol) => permiso?.roles[rol] === "ciclo");
  if (!alcanceCiclo) {
    const cicloId = await cicloAbierto(tx);
    const activos = cicloId ? await obtenerFuenteInscripciones().activosEnFecha(cicloId, hoyEnLima(ahora), tx) : [];
    const nino = activos.find((n) => n.catequizandoId === justificacion.catequizandoId);
    if (!nino || !ctx.gruposAsignados.includes(nino.grupoId)) throw new ErrorAplicacion(403, "fuera_de_alcance");
  }
  const evidencia = await repositorioEvidenciasPg.obtener(tx, justificacion.evidenciaId);
  if (!evidencia || evidencia.estado === "eliminada" || !evidencia.archivos.length) throw new ErrorAplicacion(404, "evidencia_no_disponible");
  const firmadas = await Promise.all(evidencia.archivos.map((a) => almacen.urlLectura(a.blobNombre, ahora)));
  await auditar(
    ctx,
    { accion: "evidencia:leer", recursoTipo: "justificacion", recursoId: justificacion.id, catequizandoId: justificacion.catequizandoId, resultado: "permitido" },
    tx,
  );
  return { url: firmadas[0].url, urls: firmadas.map((f) => f.url), expiraEn: firmadas[0].expiraEn };
}
