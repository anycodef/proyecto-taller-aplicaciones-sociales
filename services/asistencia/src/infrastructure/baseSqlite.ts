import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type BaseSqlite = Database.Database;

/**
 * Abre (o crea) la base y garantiza el esquema. `:memory:` sirve para pruebas.
 * Las restricciones CHECK repiten a propósito las reglas del dominio como última defensa;
 * la validación de verdad sigue estando en el dominio.
 */
export function abrirBaseSqlite(ruta: string): BaseSqlite {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });
  const db = new Database(ruta);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sesiones (
      id        TEXT PRIMARY KEY,
      grupo_id  TEXT NOT NULL,
      fecha     TEXT NOT NULL,
      tipo      TEXT NOT NULL CHECK (tipo IN ('misa', 'catequesis')),
      tema      TEXT
    );
    CREATE TABLE IF NOT EXISTS registros (
      id               TEXT PRIMARY KEY,
      sesion_id        TEXT NOT NULL,
      catequizando_id  TEXT NOT NULL,
      estado           TEXT NOT NULL CHECK (estado IN ('presente', 'tardanza', 'ausente', 'justificado')),
      registrado_por   TEXT NOT NULL,
      registrado_en    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS registros_por_catequizando ON registros (catequizando_id);
  `);
  return db;
}
