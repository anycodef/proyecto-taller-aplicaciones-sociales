import type { TipoSesion } from "@/lib/asistencia/tipos";

export type Causa = "salud_nino" | "familiar_directo" | "evento_escolar";
export type EstadoRevision = "pendiente" | "aprobada" | "rechazada";
export type EstadoVisible = EstadoRevision | "sin_efecto";
export type Canal = "enlace" | "coordinacion";

/** Ausencia a una sesión de 003; fecha y tipo se desnormalizan (D-405, RF-407). */
export type AusenciaRef = {
  catequizandoId: string;
  sesionId: string;
  tipoSesion: TipoSesion;
  fecha: string;
};

export type Justificacion = AusenciaRef & {
  id: string;
  loteId: string;
  cicloId: string;
  causa: Causa;
  anticipada: boolean;
  evidenciaId: string;
  enviadaPor: string;
  enviadaEn: string;
  canal: Canal;
  registradaPor: string | null;
  registradaEn: string | null;
  estadoRevision: EstadoRevision;
  revisadaPor: string | null;
  revisadaEn: string | null;
  motivoRechazo: string | null;
  sinEfectoDesde: string | null;
};

export type ItemLote = AusenciaRef & { justificacionId: string; anticipada: boolean };

/** La causa llega como texto porque viene de fuera y se valida en `validarLote`. */
export type EntradaLote = {
  loteId: string;
  cicloId: string;
  causa: string;
  evidenciaId: string;
  cantidadFotos: number;
  apoderadoId: string;
  canal: Canal;
  registradaPor?: string;
  ausencias: ItemLote[];
};

export class ErrorJustificacion extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
    this.name = "ErrorJustificacion";
  }
}
