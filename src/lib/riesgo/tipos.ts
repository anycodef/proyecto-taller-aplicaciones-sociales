export type Paso = "sin_riesgo" | "contacto" | "citacion" | "seguimiento" | "alerta_retiro" | "retirado";

export type EstadoFalta = "pendiente_justificar" | "en_revision" | "justificada" | "suma";

export type OrigenFalta = "domingo" | "jornada" | "papel";

export type EstadoJustificacion = "aprobada" | "pendiente" | "rechazada" | "sin_efecto";

export type FaltaParaClasificar = {
  catequizandoId: string;
  fecha: string;
  origen: "domingo" | "jornada";
  sesionIds: string[];
  justificada?: boolean;
  venceEn?: string;
};

export type Justificacion = {
  catequizandoId: string;
  fecha: string;
  estado: EstadoJustificacion;
};

export type FaltaClasificada = {
  catequizandoId: string;
  fecha: string;
  origen: OrigenFalta;
  estado: EstadoFalta;
  sesionIds: string[];
  cantidad?: number;
};

export type SaldoInicial = {
  catequizandoId: string;
  faltasNoJustificadas: number;
  fechaCorte: string;
  fichaFirmada?: boolean;
};

export type EntradaRiesgo = {
  catequizandoId: string;
  faltas: FaltaParaClasificar[];
  justificaciones?: Justificacion[];
  fichaFirmada?: boolean;
  retirado?: boolean;
  saldo?: SaldoInicial;
};

export type EstadoRiesgo = {
  catequizandoId: string;
  paso: Paso;
  conteo: number;
  sinFicha: boolean;
  pendientesJustificar: number;
  faltasOrigen: FaltaClasificada[];
};
