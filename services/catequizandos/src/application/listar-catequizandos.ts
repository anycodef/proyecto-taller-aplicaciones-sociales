import type { CatequizandoRepository } from "../domain/catequizando-repository";
import type { Reloj } from "../domain/reloj";

export class ListarCatequizandos {
  constructor(
    private readonly catequizandos: CatequizandoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(filtro: { grupoId?: string } = {}) {
    const ahora = this.reloj.ahora();
    const lista = await this.catequizandos.listar(filtro);
    return lista.map((c) => c.aResumen(ahora));
  }
}
