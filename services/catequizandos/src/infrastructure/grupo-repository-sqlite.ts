import type { Grupo } from "../domain/grupo";
import type { GrupoRepository } from "../domain/grupo-repository";
import type { BaseDeDatos } from "./sqlite";

type Fila = { id: string; ciclo_id: string; nombre: string; catequista_ids: string };

export class GrupoRepositorySqlite implements GrupoRepository {
  constructor(private readonly db: BaseDeDatos) {}

  /** Inserta los grupos que aún no existen; no sobrescribe los que ya están. */
  sembrar(grupos: Grupo[]): void {
    const insertar = this.db.prepare(
      "INSERT OR IGNORE INTO grupos (id, ciclo_id, nombre, catequista_ids) VALUES (?, ?, ?, ?)",
    );
    this.db.transaction(() => {
      for (const g of grupos) insertar.run(g.id, g.cicloId, g.nombre, JSON.stringify(g.catequistaIds));
    })();
  }

  async listar(): Promise<Grupo[]> {
    const filas = this.db.prepare("SELECT * FROM grupos ORDER BY rowid").all() as Fila[];
    return filas.map((f) => ({
      id: f.id,
      cicloId: f.ciclo_id,
      nombre: f.nombre,
      catequistaIds: JSON.parse(f.catequista_ids) as string[],
    }));
  }

  async existe(id: string): Promise<boolean> {
    return this.db.prepare("SELECT 1 FROM grupos WHERE id = ?").get(id) !== undefined;
  }
}
