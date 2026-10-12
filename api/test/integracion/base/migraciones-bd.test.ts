import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { aplicarMigraciones } from "../../../scripts/migrar";
import { crearAdministracionInicial } from "../../../scripts/crear-administracion-inicial";

test("infra: runner detecta checksum alterado, acepta migración menor tardía y deshace SQL fallido", async () => {
  const esquema = `runner_${randomUUID().replaceAll("-", "")}`;
  const carpeta = await mkdtemp(join(tmpdir(), "sigecat-migraciones-"));
  const pool = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 1 });
  const cliente = await pool.connect();
  try {
    await cliente.query(`CREATE SCHEMA ${esquema}; SET search_path TO ${esquema},pg_catalog`);
    await writeFile(join(carpeta, "0002_prueba.sql"), "CREATE TABLE prueba(id integer PRIMARY KEY);");
    await aplicarMigraciones(cliente, carpeta);
    await writeFile(join(carpeta, "0001_tardia.sql"), "CREATE TABLE tardia(id integer);");
    await aplicarMigraciones(cliente, carpeta);
    expect((await cliente.query("SELECT version FROM esquema_migracion ORDER BY version")).rows).toEqual([{ version: 1 }, { version: 2 }]);
    await writeFile(join(carpeta, "0002_prueba.sql"), "CREATE TABLE cambiado(id integer);");
    await expect(aplicarMigraciones(cliente, carpeta)).rejects.toThrow("Migracion aplicada modificada");
    await writeFile(join(carpeta, "0002_prueba.sql"), "CREATE TABLE prueba(id integer PRIMARY KEY);");
    await writeFile(join(carpeta, "0003_fallida.sql"), "CREATE TABLE no_debe_quedar(id integer); SELECT funcion_inexistente();");
    await expect(aplicarMigraciones(cliente, carpeta)).rejects.toMatchObject({ code: "42883" });
    expect((await cliente.query("SELECT to_regclass('no_debe_quedar') AS tabla")).rows[0].tabla).toBeNull();
  } finally {
    await cliente.query(`RESET search_path; DROP SCHEMA ${esquema} CASCADE`); cliente.release(); await pool.end(); await rm(carpeta, { recursive: true });
  }
});
test("RF-111 RF-102: administración inicial se crea una vez y no reemite el enlace", async () => {
  const pool = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 1 });
  const cliente = await pool.connect();
  const anterior = process.env.URL_WEB;
  process.env.URL_WEB = "https://sigecat.example";
  try {
    await cliente.query("BEGIN");
    const primera = await crearAdministracionInicial(cliente, "Administración de arranque");
    expect(primera?.url).toMatch(/^https:\/\/sigecat\.example\/acceso\/equipo#t=[A-Za-z0-9_-]{43}$/);
    expect(await crearAdministracionInicial(cliente, "Otro intento")).toBeNull();
    expect((await cliente.query("SELECT count(*)::integer AS cantidad FROM credencial WHERE cuenta_id=$1", [primera!.cuentaId])).rows[0].cantidad).toBe(1);
  } finally { await cliente.query("ROLLBACK"); cliente.release(); await pool.end(); if (anterior === undefined) delete process.env.URL_WEB; else process.env.URL_WEB = anterior; }
});
