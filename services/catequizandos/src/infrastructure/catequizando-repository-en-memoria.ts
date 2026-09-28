import type { Catequizando } from "../domain/catequizando";
import type { CatequizandoRepository } from "../domain/catequizando-repository";

export class CatequizandoRepositoryEnMemoria implements CatequizandoRepository {
  private readonly porId = new Map<string, Catequizando>();
  private contador = 0;

  constructor(iniciales: Catequizando[] = []) {
    for (const c of iniciales) this.porId.set(c.id, c);
    this.contador = iniciales.length;
  }

  siguienteId(): string {
    let id: string;
    do {
      this.contador += 1;
      id = `cat-${String(this.contador).padStart(3, "0")}`;
    } while (this.porId.has(id));
    return id;
  }

  async guardar(catequizando: Catequizando): Promise<void> {
    this.porId.set(catequizando.id, catequizando);
  }

  async obtener(id: string): Promise<Catequizando | undefined> {
    return this.porId.get(id);
  }

  async listar(filtro: { grupoId?: string } = {}): Promise<Catequizando[]> {
    const todos = [...this.porId.values()];
    return filtro.grupoId === undefined ? todos : todos.filter((c) => c.grupoId === filtro.grupoId);
  }
}
