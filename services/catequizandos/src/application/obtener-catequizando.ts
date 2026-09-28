import type { DatosCatequizando } from "../domain/catequizando";
import type { CatequizandoRepository } from "../domain/catequizando-repository";
import { NoEncontrado } from "../domain/errores";

export class ObtenerCatequizando {
  constructor(private readonly catequizandos: CatequizandoRepository) {}

  async ejecutar(id: string): Promise<DatosCatequizando> {
    const catequizando = await this.catequizandos.obtener(id);
    if (!catequizando) throw new NoEncontrado(`No existe el catequizando ${id}`);
    return catequizando.aDetalle();
  }
}
