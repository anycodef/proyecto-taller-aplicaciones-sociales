import type { Rol } from "./roles";

/**
 * Modelo de datos del sistema de catequesis.
 *
 * Principio transversal: minimizacion de datos de menores. Solo se guarda
 * lo que la coordinacion necesita para operar el ciclo catequetico, y toda
 * inscripcion exige consentimiento informado explicito.
 */

export type Usuario = {
  id: string;
  rol: Rol;
  /**
   * Nombre con el que el usuario aparece en toda vista, reporte y
   * exportacion. Para catequistas menores de edad es un seudonimo
   * institucional; para el resto coincide con su nombre real.
   */
  identidadOperativa: string;
  /** Canal de contacto real del publico objetivo. */
  telefono?: string;
  correo?: string;
  activo: boolean;
};

/**
 * Identidad real de un usuario, guardada aparte de la operativa desde el
 * diseno y no como una capa de presentacion anadida. Solo la coordinacion
 * la consulta, y nunca sale en reportes ni auditorias.
 */
export type IdentidadReal = {
  usuarioId: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
};

export type CicloCatequetico = {
  id: string;
  /** Ej. "2026 - Primera Comunion". */
  nombre: string;
  inicio: string;
  fin: string;
  /** Sesiones minimas para acceder al sacramento. */
  asistenciasRequeridas: number;
};

export type Grupo = {
  id: string;
  cicloId: string;
  nombre: string;
  catequistaIds: string[];
};

export type Catequizando = {
  id: string;
  grupoId: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  apoderadoIds: string[];
  consentimiento: Consentimiento;
};

/**
 * Categoria de acceso restringido: se recaba solo para la conformacion de
 * grupos y la ven unicamente la coordinacion y el catequista responsable
 * (ver puedeVerDatosRestringidos). Vive en su propia entidad para que un
 * listado de catequizandos nunca la arrastre por accidente, y no se
 * sincroniza al cache offline del dispositivo.
 */
export type DatosRestringidos = {
  catequizandoId: string;
  condicionesDeSalud?: string;
  neurodivergencia?: string;
  actualizadoEn: string;
};

/** Captura de consentimiento informado en el proceso de inscripcion. */
export type Consentimiento = {
  otorgadoPor: string;
  otorgadoEn: string;
  /** Version del texto aceptado, para poder auditar cambios de politica. */
  version: string;
  /** Retencion: fecha a partir de la cual el registro debe anonimizarse. */
  retencionHasta: string;
};

export type SesionCatequesis = {
  id: string;
  grupoId: string;
  fecha: string;
  tema?: string;
};

export type EstadoAsistencia =
  | "presente"
  | "tardanza"
  | "ausente"
  | "justificado";

export type RegistroAsistencia = {
  id: string;
  sesionId: string;
  catequizandoId: string;
  estado: EstadoAsistencia;
  /** Quien lo registro: la responsabilidad es nominal, no anonima. */
  registradoPor: string;
  registradoEn: string;
  /** Marca de sincronizacion: el registro nace en el dispositivo. */
  sincronizadoEn?: string;
};

/** El modelo de justificaciones vive en su dominio: sin OCR, fuera de alcance (spec 004). */
export type {
  AusenciaRef,
  Causa,
  EstadoRevision,
  EstadoVisible,
  Justificacion,
} from "@/lib/justificaciones/tipos";

/**
 * Senal de riesgo de desercion. Se calcula fuera del camino critico y
 * existe para anticipar el miedo central de la coordinadora: que el nino
 * deje de venir apenas recibe el sacramento.
 */
export type SenalRiesgo = {
  catequizandoId: string;
  nivel: "bajo" | "medio" | "alto";
  motivos: string[];
  calculadoEn: string;
};
