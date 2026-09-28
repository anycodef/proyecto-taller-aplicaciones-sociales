import type { Grupo } from "../domain/grupo";
import type { GrupoRepository } from "../domain/grupo-repository";

export class ListarGrupos {
  constructor(private readonly grupos: GrupoRepository) {}

  ejecutar(): Promise<Grupo[]> {
    return this.grupos.listar();
  }
}
