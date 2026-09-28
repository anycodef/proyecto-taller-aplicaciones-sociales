import { Catequizando, type DatosCatequizando } from "../domain/catequizando";
import type { CatequizandoRepository } from "../domain/catequizando-repository";
import type { BaseDeDatos } from "./sqlite";

type Fila = {
  id: string;
  grupo_id: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  apoderado_ids: string;
  consentimiento_por: string;
  consentimiento_en: string;
  consentimiento_version: string;
  retencion_hasta: string;
};

/**
 * Reconstituye el agregado desde la fila. No vuelve a llamar a `inscribir`: los invariantes se
 * validaron al inscribir, y volver a evaluarlos "a hoy" rechazaría a quien ya cumplió 14 años.
 * El constructor es privado solo para TypeScript, así que la infraestructura lo usa sin tocar el dominio.
 */
const reconstituir = Catequizando as unknown as new (datos: DatosCatequizando) => Catequizando;

function aAgregado(f: Fila): Catequizando {
  return new reconstituir({
    id: f.id,
    grupoId: f.grupo_id,
    nombres: f.nombres,
    apellidos: f.apellidos,
    fechaNacimiento: f.fecha_nacimiento,
    apoderadoIds: JSON.parse(f.apoderado_ids) as string[],
    consentimiento: {
      otorgadoPor: f.consentimiento_por,
      otorgadoEn: f.consentimiento_en,
      version: f.consentimiento_version,
      retencionHasta: f.retencion_hasta,
    },
  });
}

export class CatequizandoRepositorySqlite implements CatequizandoRepository {
  private contador: number;

  constructor(private readonly db: BaseDeDatos) {
    const ids = db.prepare("SELECT id FROM catequizandos").all() as { id: string }[];
    this.contador = ids.reduce((max, { id }) => Math.max(max, Number(/^cat-(\d+)$/.exec(id)?.[1] ?? 0)), 0);
  }

  siguienteId(): string {
    let id: string;
    do {
      this.contador += 1;
      id = `cat-${String(this.contador).padStart(3, "0")}`;
    } while (this.db.prepare("SELECT 1 FROM catequizandos WHERE id = ?").get(id) !== undefined);
    return id;
  }

  async guardar(catequizando: Catequizando): Promise<void> {
    const d = catequizando.aDetalle();
    this.db
      .prepare(
        `INSERT INTO catequizandos
           (id, grupo_id, nombres, apellidos, fecha_nacimiento, apoderado_ids,
            consentimiento_por, consentimiento_en, consentimiento_version, retencion_hasta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           grupo_id = excluded.grupo_id, nombres = excluded.nombres, apellidos = excluded.apellidos,
           fecha_nacimiento = excluded.fecha_nacimiento, apoderado_ids = excluded.apoderado_ids,
           consentimiento_por = excluded.consentimiento_por, consentimiento_en = excluded.consentimiento_en,
           consentimiento_version = excluded.consentimiento_version, retencion_hasta = excluded.retencion_hasta`,
      )
      .run(
        d.id,
        d.grupoId,
        d.nombres,
        d.apellidos,
        d.fechaNacimiento,
        JSON.stringify(d.apoderadoIds),
        d.consentimiento.otorgadoPor,
        d.consentimiento.otorgadoEn,
        d.consentimiento.version,
        d.consentimiento.retencionHasta,
      );
  }

  async obtener(id: string): Promise<Catequizando | undefined> {
    const fila = this.db.prepare("SELECT * FROM catequizandos WHERE id = ?").get(id) as Fila | undefined;
    return fila && aAgregado(fila);
  }

  async listar(filtro: { grupoId?: string } = {}): Promise<Catequizando[]> {
    const filas =
      filtro.grupoId === undefined
        ? (this.db.prepare("SELECT * FROM catequizandos ORDER BY rowid").all() as Fila[])
        : (this.db
            .prepare("SELECT * FROM catequizandos WHERE grupo_id = ? ORDER BY rowid")
            .all(filtro.grupoId) as Fila[]);
    return filas.map(aAgregado);
  }

  /** Inserta solo si la tabla está vacía: reiniciar el servicio no pisa lo ya guardado. */
  async sembrarSiVacio(catequizandos: Catequizando[]): Promise<void> {
    const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM catequizandos").get() as { n: number };
    if (n > 0) return;
    for (const c of catequizandos) await this.guardar(c);
    this.contador = Math.max(this.contador, catequizandos.length);
  }
}
