import type { Justificacion } from "@/lib/justificaciones/tipos";

export function justificacion(parcial: Partial<Justificacion> = {}): Justificacion {
  return {
    id: "j-1",
    loteId: "lote-1",
    cicloId: "ciclo-1",
    catequizandoId: "nino-1",
    sesionId: "misa-0101",
    tipoSesion: "misa",
    fecha: "2026-11-01",
    causa: "salud_nino",
    anticipada: false,
    evidenciaId: "ev-1",
    enviadaPor: "apoderado-1",
    enviadaEn: "2026-11-02T10:00:00-05:00",
    canal: "enlace",
    registradaPor: null,
    registradaEn: null,
    estadoRevision: "pendiente",
    revisadaPor: null,
    revisadaEn: null,
    motivoRechazo: null,
    sinEfectoDesde: null,
    ...parcial,
  };
}
