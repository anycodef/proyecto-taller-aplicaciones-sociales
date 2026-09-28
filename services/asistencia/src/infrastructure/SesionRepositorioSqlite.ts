import { SesionCatequesis, TipoSesion } from "../domain/SesionCatequesis";
import { SesionRepositorio } from "../domain/SesionRepositorio";
import { BaseSqlite } from "./baseSqlite";

type Fila = { id: string; grupo_id: string; fecha: string; tipo: TipoSesion; tema: string | null };

export class SesionRepositorioSqlite implements SesionRepositorio {
  constructor(private readonly db: BaseSqlite) {}

  async guardar(sesion: SesionCatequesis): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO sesiones (id, grupo_id, fecha, tipo, tema) VALUES (@id, @grupoId, @fecha, @tipo, @tema)
         ON CONFLICT(id) DO UPDATE SET grupo_id = excluded.grupo_id, fecha = excluded.fecha,
                                       tipo = excluded.tipo, tema = excluded.tema`,
      )
      .run({ ...sesion, tema: sesion.tema ?? null });
  }

  async buscarPorIds(ids: readonly string[]): Promise<SesionCatequesis[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const marcas = unicos.map(() => "?").join(", ");
    const filas = this.db.prepare(`SELECT * FROM sesiones WHERE id IN (${marcas})`).all(...unicos) as Fila[];
    return filas.map((f) => ({
      id: f.id,
      grupoId: f.grupo_id,
      fecha: f.fecha,
      tipo: f.tipo,
      ...(f.tema === null ? {} : { tema: f.tema }),
    }));
  }
}
