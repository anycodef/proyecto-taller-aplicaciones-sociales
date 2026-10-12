import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

export async function aplicarMigraciones(cliente: PoolClient, carpeta = resolve(__dirname, "../migraciones")): Promise<void> {
  await cliente.query("SELECT pg_advisory_lock(731001)");
  try {
    await cliente.query("CREATE TABLE IF NOT EXISTS esquema_migracion(version integer PRIMARY KEY,nombre text NOT NULL,checksum_sha256 text NOT NULL,aplicada_en timestamptz NOT NULL DEFAULT now())");
    const archivos = (await readdir(carpeta)).filter(nombre => /^\d{4}_[a-z0-9_]+\.sql$/.test(nombre)).sort();
    for (const nombre of archivos) {
      const sql = await readFile(resolve(carpeta, nombre), "utf8");
      const version = Number(nombre.slice(0, 4));
      const checksum = createHash("sha256").update(sql).digest("hex");
      const anterior = await cliente.query<{ checksum_sha256: string; nombre: string }>("SELECT checksum_sha256,nombre FROM esquema_migracion WHERE version=$1", [version]);
      if (anterior.rowCount) {
        if (anterior.rows[0].checksum_sha256 !== checksum || anterior.rows[0].nombre !== nombre) throw new Error(`Migracion aplicada modificada: ${nombre}`);
        continue;
      }
      await cliente.query("BEGIN");
      try {
        await cliente.query(sql);
        await cliente.query("INSERT INTO esquema_migracion(version,nombre,checksum_sha256) VALUES($1,$2,$3)", [version, nombre, checksum]);
        await cliente.query("COMMIT");
      } catch (error) { await cliente.query("ROLLBACK"); throw error; }
    }
  } finally { await cliente.query("SELECT pg_advisory_unlock(731001)"); }
}
if (require.main === module) {
  const url = process.env.BD_MIGRACIONES_URL ?? process.env.BD_URL;
  if (!url) throw new Error("Falta BD_MIGRACIONES_URL o BD_URL");
  const pool = new Pool({ connectionString: url, max: 1 });
  (async () => { const cliente = await pool.connect(); try { await aplicarMigraciones(cliente); } finally { cliente.release(); await pool.end(); } })().catch(() => { console.error("Fallo de migracion; revisar configuracion y privilegios de BD"); process.exitCode = 1; });
}
