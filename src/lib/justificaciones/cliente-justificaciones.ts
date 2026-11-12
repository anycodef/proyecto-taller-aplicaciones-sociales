import type { TipoSesion } from "@/lib/asistencia/tipos";
import type { Causa, EstadoVisible } from "./tipos";

/** Datos binarios de una foto ya comprimida; `Blob` en web y en React Native. */
export type DatosBinarios = Blob | ArrayBuffer | Uint8Array;

/** Puerto mínimo: el cliente HTTP de la plataforma aporta `solicitar` y, para la subida de fotos, `solicitarBinario`. */
export type ClienteHttpJustificaciones = {
  solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T>;
  solicitarBinario?<T>(metodo: string, ruta: string, datos: DatosBinarios, contentType: string): Promise<T>;
};

export type AusenciaJustificable = {
  catequizandoId: string;
  nombre: string;
  sesionId: string;
  tipoSesion: TipoSesion;
  fecha: string;
  venceEn: string;
};

export type JustificacionFamilia = {
  id: string;
  catequizandoId: string;
  nombre: string;
  fecha: string;
  tipoSesion: TipoSesion;
  causa: Causa;
  estadoVisible: EstadoVisible;
  motivoRechazo?: string;
  origen: "propia" | "otro_apoderado" | "coordinacion";
};

export type EvidenciaReserva = { evidenciaId: string; archivos: { orden: number }[] };

export type EntradaLote = {
  loteId: string;
  causa: Causa;
  evidenciaId: string;
  ausencias: { catequizandoId: string; sesionId: string; justificacionId: string }[];
};

export type LoteCreado = {
  loteId: string;
  justificaciones: { id: string; catequizandoId: string; sesionId: string; fecha: string; tipoSesion: TipoSesion; estadoVisible: EstadoVisible }[];
};

export type JustificacionBandeja = {
  id: string;
  catequizandoId: string;
  nombre: string;
  fecha: string;
  tipoSesion: TipoSesion;
  causa: Causa;
  enviadaEn: string;
  canal: "enlace" | "coordinacion";
  duplicada: boolean;
};
export type LoteBandeja = { loteId: string; justificaciones: JustificacionBandeja[] };

export type DecisionRevision = "aprobada" | "rechazada";
export type ResultadoRevision = { revisadas: { id: string; estadoVisible: EstadoVisible }[] };
export type LecturaEvidencia = { url: string; urls: string[]; expiraEn: string };

/** Cliente tipado de 004. Sin React ni Expo: lo usan las pantallas y las pruebas con un doble. */
export function crearClienteJustificaciones(cliente: ClienteHttpJustificaciones) {
  return {
    async ausenciasJustificables(): Promise<AusenciaJustificable[]> {
      return (await cliente.solicitar<{ ausencias: AusenciaJustificable[] }>("GET", "/familia/ausencias-justificables")).ausencias;
    },
    async misJustificaciones(): Promise<JustificacionFamilia[]> {
      return (await cliente.solicitar<{ justificaciones: JustificacionFamilia[] }>("GET", "/familia/justificaciones")).justificaciones;
    },
    reservarEvidencia(archivos: { bytes: number; contentType: "image/jpeg" }[]): Promise<EvidenciaReserva> {
      return cliente.solicitar<EvidenciaReserva>("POST", "/evidencias/reservas", { archivos });
    },
    /** La foto nunca se guarda en el celular para reintentar después (RNF-404): solo viaja en esta llamada. */
    subirArchivo(evidenciaId: string, orden: number, datos: DatosBinarios): Promise<{ orden: number; bytes: number }> {
      if (!cliente.solicitarBinario) throw new Error("subida_no_disponible");
      return cliente.solicitarBinario("PUT", `/evidencias/${evidenciaId}/archivos/${orden}`, datos, "image/jpeg");
    },
    crearLote(entrada: EntradaLote): Promise<LoteCreado> {
      return cliente.solicitar<LoteCreado>("POST", "/justificaciones/lotes", entrada);
    },
    async bandeja(): Promise<LoteBandeja[]> {
      return (await cliente.solicitar<{ lotes: LoteBandeja[] }>("GET", "/justificaciones/bandeja")).lotes;
    },
    revisar(justificacionIds: string[], decision: DecisionRevision, motivo?: string): Promise<ResultadoRevision> {
      return cliente.solicitar<ResultadoRevision>("POST", "/justificaciones/revisiones", {
        justificacionIds,
        decision,
        ...(motivo ? { motivo } : {}),
      });
    },
    evidencia(justificacionId: string): Promise<LecturaEvidencia> {
      return cliente.solicitar<LecturaEvidencia>("GET", `/justificaciones/${justificacionId}/evidencia`);
    },
  };
}
export type ClienteJustificaciones = ReturnType<typeof crearClienteJustificaciones>;
