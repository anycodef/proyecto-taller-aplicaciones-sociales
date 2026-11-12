import type { AusenciaRef, EstadoVisible, Justificacion } from "@/lib/justificaciones/tipos";
import type { Tx } from "../../../compartido/bd/transaccion";

export type EstadoEvidencia = "reservada" | "confirmada" | "eliminada";
export type MotivoEliminacion = "consentimiento" | "retencion" | "huerfana";
export type ArchivoGuardado = { orden: number; blobNombre: string; bytes: number; contentType: string };
export type Evidencia = {
  id: string;
  cicloId: string;
  subidaPor: string;
  estado: EstadoEvidencia;
  reservadaEn: string;
  confirmadaEn: string | null;
  archivos: ArchivoGuardado[];
};

/** Una reserva sin confirmar tras este tiempo se considera abandonada (D-412). */
export const HORAS_RESERVA_HUERFANA = 24;
export const VENTANA_LIMITE_RESERVAS_MS = 60 * 60 * 1000;

/** Contenedor Blob privado de las evidencias (plan 004, §3.3). */
export const CONTENEDOR_EVIDENCIAS = "evidencias";
export const nombreBlob = (cicloId: string, evidenciaId: string, orden: number): string => `${cicloId}/${evidenciaId}/${orden}.jpg`;

export interface RepositorioEvidencias {
  reservar(tx: Tx, entrada: { id: string; cicloId: string; subidaPor: string; en: Date }): Promise<void>;
  /** Devuelve false si la evidencia no existe o ya no está reservada. */
  confirmar(tx: Tx, id: string, archivos: readonly ArchivoGuardado[], en: Date): Promise<boolean>;
  obtener(tx: Tx, id: string): Promise<Evidencia | undefined>;
  listarHuerfanas(tx: Tx, ahora: Date): Promise<Evidencia[]>;
  contarReservasRecientes(tx: Tx, cuentaId: string, ahora: Date): Promise<number>;
  marcarEliminada(tx: Tx, id: string, motivo: MotivoEliminacion): Promise<boolean>;
}

export type UrlFirmada = { url: string; expiraEn: string };
export type InspeccionBlob = { bytes: number; contentType: string; firmaJpeg: boolean };

/** Blob Storage privado con URLs SAS de 5 minutos (D-402, D-410). */
export interface AlmacenEvidencias {
  /** Solo permite crear: una subida no puede sobrescribir un blob existente. */
  urlSubida(blobNombre: string, ahora: Date): Promise<UrlFirmada>;
  /** Solo lectura y Cache-Control no-store para que el visor no guarde copia. */
  urlLectura(blobNombre: string, ahora: Date): Promise<UrlFirmada>;
  inspeccionar(blobNombre: string): Promise<InspeccionBlob | undefined>;
  borrar(blobNombre: string): Promise<void>;
  /** Devuelve cuántos blobs borró con ese prefijo. */
  borrarPrefijo(prefijo: string): Promise<number>;
}

export interface RepositorioJustificaciones {
  /** Idempotente por id de justificación: reenviar el lote devuelve lo ya guardado (D-413). */
  insertarLote(tx: Tx, justificaciones: readonly Justificacion[], por: string | null): Promise<Justificacion[]>;
  obtener(tx: Tx, id: string): Promise<Justificacion | undefined>;
  obtenerLote(tx: Tx, loteId: string): Promise<Justificacion[]>;
  /** Persiste el resultado de `revisar` del dominio; falla si ya no estaba pendiente. */
  guardarRevision(tx: Tx, revisada: Justificacion): Promise<void>;
  /** Devuelve los ids afectados; la justificación se conserva (RF-407). */
  marcarSinEfecto(tx: Tx, ausencia: Pick<AusenciaRef, "catequizandoId" | "sesionId">, en: Date): Promise<string[]>;
  restaurarEfecto(tx: Tx, ausencia: Pick<AusenciaRef, "catequizandoId" | "sesionId">): Promise<string[]>;
  /** Pendientes con efecto del ciclo, agrupadas por lote para revisarlas juntas (RF-403, RF-408). */
  bandeja(tx: Tx, cicloId: string): Promise<LoteBandeja[]>;
  listarPorCatequizando(tx: Tx, catequizandoId: string): Promise<Justificacion[]>;
  /** Para las consultas en proceso de 003, 006 y 007 (D-414). */
  listarPorCiclo(tx: Tx, cicloId: string): Promise<Justificacion[]>;
  /** Todas las de sus hijos con vínculo vigente, también las del otro apoderado (supuesto A-14). */
  listarPorApoderado(tx: Tx, apoderadoId: string): Promise<Justificacion[]>;
  /** Para el pull de 003: solo estado, sin causa, motivo ni evidencia (D-408). Puede reentregar la última fila del cursor. */
  cambiosDesde(tx: Tx, desde: Date, catequizandoIds?: readonly string[]): Promise<CambioEstado[]>;
  /** Sin definición del ciclo devuelve el plazo predeterminado (supuesto A-11). */
  obtenerPlazo(tx: Tx, cicloId: string): Promise<PlazoCiclo>;
  definirPlazo(tx: Tx, cicloId: string, diasPlazo: number, por: string, en: Date): Promise<PlazoCiclo>;
}

export type PlazoCiclo = { cicloId: string; diasPlazo: number; predeterminado: boolean; definidoPor: string | null; definidoEn: string | null };

export type JustificacionEnBandeja = Justificacion & { duplicada: boolean };
export type LoteBandeja = { loteId: string; justificaciones: JustificacionEnBandeja[] };
export type CambioEstado = Pick<AusenciaRef, "catequizandoId" | "sesionId" | "fecha" | "tipoSesion"> & { id: string; estadoVisible: EstadoVisible; actualizadoEn: string };

/** 006 y 007 se suscriben en proceso; la notificación corre en la misma transacción (D-414). */
export type AlCambiarJustificacion = (evento: { justificaciones: readonly Justificacion[] }, tx: Tx) => Promise<void>;
let alCambiarJustificacion: AlCambiarJustificacion = async () => undefined;
export function registrarAlCambiarJustificacion(puerto: AlCambiarJustificacion): void { alCambiarJustificacion = puerto; }
export async function notificarCambioJustificacion(justificaciones: readonly Justificacion[], tx: Tx): Promise<void> {
  if (justificaciones.length) await alCambiarJustificacion({ justificaciones }, tx);
}
