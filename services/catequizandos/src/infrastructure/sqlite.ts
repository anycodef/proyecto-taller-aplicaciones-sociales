import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type BaseDeDatos = Database.Database;

/** Abre (o crea) la base y el esquema. `:memory:` sirve para pruebas. */
export function abrirBaseSqlite(ruta: string): BaseDeDatos {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });
  const db = new Database(ruta);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS grupos (
      id             TEXT PRIMARY KEY,
      ciclo_id       TEXT NOT NULL,
      nombre         TEXT NOT NULL,
      catequista_ids TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catequizandos (
      id                     TEXT PRIMARY KEY,
      grupo_id               TEXT NOT NULL,
      nombres                TEXT NOT NULL,
      apellidos              TEXT NOT NULL,
      fecha_nacimiento       TEXT NOT NULL,
      apoderado_ids          TEXT NOT NULL,
      consentimiento_por     TEXT NOT NULL,
      consentimiento_en      TEXT NOT NULL,
      consentimiento_version TEXT NOT NULL,
      retencion_hasta        TEXT NOT NULL
    );
  `);
  return db;
}
