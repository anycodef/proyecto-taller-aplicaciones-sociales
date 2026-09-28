import type { Grupo } from "./grupo";

export interface GrupoRepository {
  listar(): Promise<Grupo[]>;
  existe(id: string): Promise<boolean>;
}
