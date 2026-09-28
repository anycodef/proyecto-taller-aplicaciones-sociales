import { RegistroAsistencia } from "./RegistroAsistencia";

/** Puerto de persistencia de los registros de asistencia. Lo implementa la infraestructura. */
export interface RegistroRepositorio {
  /** Upsert por `registro.id`: reenviar el mismo lote no duplica ni pierde nada. */
  guardarVarios(registros: readonly RegistroAsistencia[]): Promise<void>;
  listarPorCatequizando(catequizandoId: string): Promise<RegistroAsistencia[]>;
}
