import { SesionCatequesis } from "./SesionCatequesis";

/** Puerto de persistencia del agregado sesión. Lo implementa la infraestructura. */
export interface SesionRepositorio {
  /** Upsert por `sesion.id`: guardar dos veces la misma sesión deja una sola. */
  guardar(sesion: SesionCatequesis): Promise<void>;
  buscarPorIds(ids: readonly string[]): Promise<SesionCatequesis[]>;
}
