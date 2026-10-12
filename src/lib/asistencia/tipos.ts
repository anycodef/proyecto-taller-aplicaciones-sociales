export type ValorAsistencia = "presente" | "ausente";
export type ValorAnteriorAsistencia = ValorAsistencia | "sin_registro";
export type EstadoEnSesion = ValorAsistencia | "sin_registro" | "pendiente" | "no_aplica";
export type TipoSesion = "misa" | "catequesis" | "actividad";
export type TipoRegistro = "escaneo" | "manual" | "lista";
export interface ParametrosAsistencia {
  zonaHoraria: "America/Lima";
  ventanaMisaInicio: string;
  ventanaMisaFin: string;
  horaFinDomingo: string;
  toleranciaRelojMin: number;
}
export const PARAMETROS_PREDETERMINADOS: ParametrosAsistencia = {
  zonaHoraria: "America/Lima", ventanaMisaInicio: "07:30:00", ventanaMisaFin: "09:30:00",
  horaFinDomingo: "23:59:59", toleranciaRelojMin: 10,
};
export interface Sesion {
  id: string; cicloId: string; fecha: string; tipo: TipoSesion;
  actividadId?: string | null; tipoActividad?: string; cancelada: boolean;
  ventanaInicio?: string | null; ventanaFin?: string | null;
}
export interface MarcaAsistencia {
  id: string; cicloId: string; sesionId: string; catequizandoId: string | null;
  codigoLeido?: string | null; valor: ValorAsistencia; tipoRegistro: TipoRegistro;
  listaId?: string | null; registradoPor: string; credencialId: string; dispositivoId: string;
  horaDispositivo: string; desfaseRelojMs: number; recibidoEn?: string;
  estado: "pendiente" | "aceptada" | "rechazada"; motivoRechazo?: string | null;
}
export interface ListaAsistencia {
  id: string; cicloId: string; sesionId: string; grupoId: string; confirmadaPor: string;
  credencialId: string; dispositivoId: string; abiertaEn: string; confirmadaEn: string;
  desfaseRelojMs: number; totalPresentes: number; totalAusentes: number;
}
export interface Correccion {
  id: string; cicloId: string; sesionId: string; catequizandoId: string;
  valorAnterior: ValorAnteriorAsistencia; valorNuevo: ValorAsistencia; motivo?: string | null;
  corregidoPor: string; credencialId: string; horaDispositivo: string;
  desfaseRelojMs: number; recibidoEn: string; estado: "aceptada" | "rechazada";
}
export interface AsistenciaConsolidada {
  valor: ValorAsistencia; tipoRegistro: TipoRegistro; horaPrimerRegistro: string;
  recibidoPrimerRegistro: string; registradores: string[]; conflicto: boolean; corregida: boolean;
}
export interface Falta {
  catequizandoId: string; fecha: string; origen: "domingo" | "jornada";
  sesionIds: string[]; justificada: boolean;
}
export interface NinoNomina {
  id: string; nombres: string; apellidos: string; grupoId: string; codigoCarne: string | null; activo: boolean;
}
