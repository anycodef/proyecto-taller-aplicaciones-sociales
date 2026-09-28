import { EstadoAsistencia } from "../domain/EstadoAsistencia";
import { RegistroAsistencia } from "../domain/RegistroAsistencia";
import { RegistroRepositorio } from "../domain/RegistroRepositorio";
import { BaseSqlite } from "./baseSqlite";

type Fila = {
  id: string;
  sesion_id: string;
  catequizando_id: string;
  estado: EstadoAsistencia;
  registrado_por: string;
  registrado_en: string;
};

export class RegistroRepositorioSqlite implements RegistroRepositorio {
  constructor(private readonly db: BaseSqlite) {}

  async guardarVarios(registros: readonly RegistroAsistencia[]): Promise<void> {
    const upsert = this.db.prepare(
      `INSERT INTO registros (id, sesion_id, catequizando_id, estado, registrado_por, registrado_en)
       VALUES (@id, @sesionId, @catequizandoId, @estado, @registradoPor, @registradoEn)
       ON CONFLICT(id) DO UPDATE SET sesion_id = excluded.sesion_id, catequizando_id = excluded.catequizando_id,
                                     estado = excluded.estado, registrado_por = excluded.registrado_por,
                                     registrado_en = excluded.registrado_en`,
    );
    // Una transacción: el lote se guarda entero o no se guarda.
    this.db.transaction((lote: readonly RegistroAsistencia[]) => {
      for (const registro of lote) upsert.run(registro);
    })(registros);
  }

  async listarPorCatequizando(catequizandoId: string): Promise<RegistroAsistencia[]> {
    const filas = this.db
      .prepare("SELECT * FROM registros WHERE catequizando_id = ? ORDER BY rowid")
      .all(catequizandoId) as Fila[];
    return filas.map((f) => ({
      id: f.id,
      sesionId: f.sesion_id,
      catequizandoId: f.catequizando_id,
      estado: f.estado,
      registradoPor: f.registrado_por,
      registradoEn: f.registrado_en,
    }));
  }
}
