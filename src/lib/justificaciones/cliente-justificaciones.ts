import type { AusenciaRef, Causa, EstadoVisible } from "./tipos";

export type ClienteHttp = { solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> };

export type AusenciaJustificable = AusenciaRef & { venceEn: string };
export type RespuestaJustificables = { cicloId: string; diasPlazo: number; ninos: { catequizandoId: string; nombres: string }[]; ausencias: AusenciaJustificable[] };
export type RespuestaAnticipables = { cicloId: string; sesiones: AusenciaRef[] };
export type OrigenJustificacion = "usted" | "otro_apoderado" | "coordinacion";
export type JustificacionFamilia = AusenciaRef & {
  id: string; estado: EstadoVisible; motivoRechazo: string | null; enviadaEn: string; origen: OrigenJustificacion; causa: Causa | null;
};
export type ArchivoDeclarado = { orden: number; bytes: number; contentType: string };
export type Reserva = { evidenciaId: string; expiraEn: string; archivos: { orden: number; url: string }[] };
export type AusenciaDelLote = { justificacionId: string; catequizandoId: string; sesionId: string; anticipada: boolean };
export type PeticionLote = { loteId: string; evidenciaId: string; causa: Causa; ausencias: AusenciaDelLote[]; apoderadoId?: string };
export type RespuestaLote = {
  loteId: string; evidenciaId: string;
  justificaciones: (AusenciaRef & { id: string; anticipada: boolean; estado: "pendiente" })[];
};

export type Plazo = { cicloId: string; diasPlazo: number; predeterminado: boolean; definidoPor: string | null; definidoEn: string | null };
export type JustificacionEnBandeja = AusenciaRef & { id: string; nombre: string; anticipada: boolean; duplicada: boolean };
export type LoteEnBandeja = { loteId: string; evidenciaId: string; causa: Causa; canal: "enlace" | "coordinacion"; enviadaEn: string; justificaciones: JustificacionEnBandeja[] };
export type Bandeja = { cicloId: string; lotes: LoteEnBandeja[] };
export type Evidencia = { justificacionId: string; evidenciaId: string; expiraEn: string; archivos: { orden: number; url: string }[] };
export type JustificablesDeNino = {
  cicloId: string; diasPlazo: number; nino: { catequizandoId: string; nombre: string };
  apoderados: { apoderadoId: string; nombre: string; relacion: string }[]; ausencias: AusenciaJustificable[];
};
export type Revisada = { id: string; estado: EstadoVisible };

/** Solo red: nada de lo que viaja aquí se guarda en el dispositivo (RNF-404). */
export function crearClienteJustificaciones(cliente: ClienteHttp) {
  return {
    ausenciasJustificables: () => cliente.solicitar<RespuestaJustificables>("GET", "/familia/ausencias-justificables"),
    sesionesAnticipables: () => cliente.solicitar<RespuestaAnticipables>("GET", "/familia/sesiones-anticipables"),
    misJustificaciones: async () => (await cliente.solicitar<{ justificaciones: JustificacionFamilia[] }>("GET", "/familia/justificaciones")).justificaciones,
    reservarEvidencia: (evidenciaId: string, archivos: ArchivoDeclarado[]) => cliente.solicitar<Reserva>("POST", "/evidencias/reservas", { evidenciaId, archivos }),
    crearLote: (peticion: PeticionLote) => cliente.solicitar<RespuestaLote>("POST", "/justificaciones/lotes", peticion),
    obtenerPlazo: (cicloId: string) => cliente.solicitar<Plazo>("GET", `/ciclos/${encodeURIComponent(cicloId)}/plazo-justificacion`),
    definirPlazo: (cicloId: string, diasPlazo: number) => cliente.solicitar<Plazo>("PUT", `/ciclos/${encodeURIComponent(cicloId)}/plazo-justificacion`, { diasPlazo }),
    bandeja: () => cliente.solicitar<Bandeja>("GET", "/justificaciones/bandeja"),
    revisar: async (ids: string[], decision: "aprobada" | "rechazada", motivo?: string) =>
      (await cliente.solicitar<{ revisadas: Revisada[] }>("POST", "/justificaciones/revisiones", { ids, decision, ...(motivo ? { motivo } : {}) })).revisadas,
    evidencia: (justificacionId: string) => cliente.solicitar<Evidencia>("GET", `/justificaciones/${encodeURIComponent(justificacionId)}/evidencia`),
    justificablesDeNino: (catequizandoId: string) =>
      cliente.solicitar<JustificablesDeNino>("GET", `/coordinacion/catequizandos/${encodeURIComponent(catequizandoId)}/ausencias-justificables`),
  };
}
export type ClienteJustificaciones = ReturnType<typeof crearClienteJustificaciones>;
