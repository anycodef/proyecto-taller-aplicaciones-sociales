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
  nombre: string;
  rol: Rol;
  /** Canal de contacto real del publico objetivo. */
  telefono?: string;
  correo?: string;
  activo: boolean;
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

/**
 * Justificacion enviada por la familia. La lectura por OCR corre de forma
 * asincrona y desacoplada: nunca bloquea el registro de asistencia.
 */
export type Justificacion = {
  id: string;
  catequizandoId: string;
  sesionId: string;
  enviadaPor: string;
  enviadaEn: string;
  /** Referencia al archivo en almacenamiento de objetos, no el binario. */
  adjuntoUrl?: string;
  ocr?: ResultadoOcr;
  revision: "pendiente" | "aceptada" | "rechazada";
  revisadaPor?: string;
};

export type ResultadoOcr = {
  texto: string;
  /** 0 a 1. Por debajo del umbral la justificacion pasa a revision manual. */
  confianza: number;
  procesadoEn: string;
};

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
