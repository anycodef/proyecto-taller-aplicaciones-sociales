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
export type PeticionLote = { loteId: string; evidenciaId: string; causa: Causa; ausencias: AusenciaDelLote[] };
export type RespuestaLote = {
  loteId: string; evidenciaId: string;
  justificaciones: (AusenciaRef & { id: string; anticipada: boolean; estado: "pendiente" })[];
};

/** Solo red: nada de lo que viaja aquí se guarda en el dispositivo (RNF-404). */
export function crearClienteJustificaciones(cliente: ClienteHttp) {
  return {
    ausenciasJustificables: () => cliente.solicitar<RespuestaJustificables>("GET", "/familia/ausencias-justificables"),
    sesionesAnticipables: () => cliente.solicitar<RespuestaAnticipables>("GET", "/familia/sesiones-anticipables"),
    misJustificaciones: async () => (await cliente.solicitar<{ justificaciones: JustificacionFamilia[] }>("GET", "/familia/justificaciones")).justificaciones,
    reservarEvidencia: (evidenciaId: string, archivos: ArchivoDeclarado[]) => cliente.solicitar<Reserva>("POST", "/evidencias/reservas", { evidenciaId, archivos }),
    crearLote: (peticion: PeticionLote) => cliente.solicitar<RespuestaLote>("POST", "/justificaciones/lotes", peticion),
  };
}
export type ClienteJustificaciones = ReturnType<typeof crearClienteJustificaciones>;
