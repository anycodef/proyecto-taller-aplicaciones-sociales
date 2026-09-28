import { RegistroAsistencia } from "../domain/RegistroAsistencia";
import { RegistroRepositorio } from "../domain/RegistroRepositorio";

export class RegistroRepositorioEnMemoria implements RegistroRepositorio {
  private readonly porId = new Map<string, RegistroAsistencia>();

  async guardarVarios(registros: readonly RegistroAsistencia[]): Promise<void> {
    for (const registro of registros) this.porId.set(registro.id, { ...registro });
  }

  async listarPorCatequizando(catequizandoId: string): Promise<RegistroAsistencia[]> {
    return [...this.porId.values()]
      .filter((registro) => registro.catequizandoId === catequizandoId)
      .map((registro) => ({ ...registro }));
  }
}
