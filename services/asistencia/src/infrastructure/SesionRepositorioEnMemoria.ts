import { SesionCatequesis } from "../domain/SesionCatequesis";
import { SesionRepositorio } from "../domain/SesionRepositorio";

export class SesionRepositorioEnMemoria implements SesionRepositorio {
  private readonly porId = new Map<string, SesionCatequesis>();

  async guardar(sesion: SesionCatequesis): Promise<void> {
    this.porId.set(sesion.id, { ...sesion });
  }

  async buscarPorIds(ids: readonly string[]): Promise<SesionCatequesis[]> {
    return [...new Set(ids)].flatMap((id) => {
      const sesion = this.porId.get(id);
      return sesion ? [{ ...sesion }] : [];
    });
  }
}
