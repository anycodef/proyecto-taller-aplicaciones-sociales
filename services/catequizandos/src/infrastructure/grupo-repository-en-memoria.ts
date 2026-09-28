import type { Grupo } from "../domain/grupo";
import type { GrupoRepository } from "../domain/grupo-repository";

export class GrupoRepositoryEnMemoria implements GrupoRepository {
  constructor(private readonly grupos: Grupo[]) {}

  async listar(): Promise<Grupo[]> {
    return this.grupos.map((g) => ({ ...g, catequistaIds: [...g.catequistaIds] }));
  }

  async existe(id: string): Promise<boolean> {
    return this.grupos.some((g) => g.id === id);
  }
}
