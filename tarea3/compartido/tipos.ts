// Tipos TypeScript generados a mano de los contratos congelados (spec 009).
// schema.graphql y sigecat.proto. Para que P2, P3 y P4 los importen sin depender
// de código de otra persona.

export type RolDemo = 'COORD' | 'CAT' | 'FAM' | 'SUP';
export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADA' | 'TARDANZA';
export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO';
export type FechaCivil = string; // AAAA-MM-DD

export interface Contexto {
  identidadOperativa: string;
  rol: RolDemo;
  grupoId: string | null;
}

export interface Catequizando {
  id: string;
  identidadOperativa: string;
  edad: number;
  grupo: Grupo;
  asistencias: Asistencia[];
  riesgo: Riesgo | null;
}

export interface Grupo {
  id: string;
  nombre: string;
}

export interface Asistencia {
  id: string;
  fecha: FechaCivil;
  estado: EstadoAsistencia;
  registradoPor: string; // siempre identidadOperativa
}

export interface Riesgo {
  catequizandoId: string;
  nivel: NivelRiesgo;
  motivo: string;
  calculadoEn: string; // ISO 8601
}

export interface ConexionCatequizandos {
  nodos: Catequizando[];
  siguiente: string | null;
  total: number;
}

export interface ResumenAsistencia {
  fecha: FechaCivil;
  presentes: number;
  ausentes: number;
  justificadas: number;
  tardanzas: number;
}

export interface ResultadoEscritura {
  id: string;
  repetido: boolean;
}

// Mensajes gRPC (sigecat.proto), mismos nombres de campo que el contrato.
export interface gRPCRegistrarAsistenciaSolicitud {
  id: string;
  catequizando_id: string;
  fecha: string; // AAAA-MM-DD
  estado: EstadoAsistencia;
}
export interface gRPCResultadoEscritura {
  id: string;
  repetido: boolean;
}
export interface gRPCResumenLote {
  registrados: number;
  repetidos: number;
  rechazados: number;
}
export interface gRPCRecalcularRiesgoSolicitud {
  catequizando_id: string;
}
export interface gRPCRiesgo {
  catequizando_id: string;
  nivel: NivelRiesgo;
  motivo: string;
  calculado_en: string;
}
export interface gRPCObservarSolicitud {
  grupo_id: string;
}
export interface gRPCEventoAsistencia {
  asistencia_id: string;
  catequizando_id: string;
  identidad_operativa: string;
  estado: EstadoAsistencia;
  fecha: string;
}
