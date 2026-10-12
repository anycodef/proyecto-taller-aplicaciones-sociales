import { Client } from "pg";

export async function configurarRoles(): Promise<void> {
  if (!process.env.BD_ADMIN_URL || !process.env.BD_API_CLAVE || !process.env.BD_MIGRADOR_CLAVE) throw new Error("Faltan BD_ADMIN_URL, BD_API_CLAVE o BD_MIGRADOR_CLAVE");
  const cliente = new Client({ connectionString: process.env.BD_ADMIN_URL });
  await cliente.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigecat_migrador') THEN CREATE ROLE sigecat_migrador LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigecat_api') THEN CREATE ROLE sigecat_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigecat_retencion') THEN CREATE ROLE sigecat_retencion NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF;
    END $$;
    GRANT sigecat_retencion TO sigecat_migrador WITH ADMIN OPTION;
    GRANT sigecat_retencion TO sigecat_api WITH SET TRUE;
    GRANT sigecat_retencion TO sigecat_api WITH INHERIT FALSE;`);
    const otorgamientos = await cliente.query<{ sql: string }>("SELECT format('GRANT sigecat_migrador TO %I',current_user) AS sql UNION ALL SELECT format('ALTER DATABASE %I OWNER TO sigecat_migrador',current_database())");
    for (const fila of otorgamientos.rows) await cliente.query(fila.sql);
    await cliente.query("ALTER SCHEMA public OWNER TO sigecat_migrador; REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE,CREATE ON SCHEMA public TO sigecat_migrador; GRANT USAGE ON SCHEMA public TO sigecat_api,sigecat_retencion");
    for (const [rol, clave] of [["sigecat_api", process.env.BD_API_CLAVE], ["sigecat_migrador", process.env.BD_MIGRADOR_CLAVE]]) {
      const instruccion = await cliente.query<{ sql: string }>("SELECT format('ALTER ROLE %I PASSWORD %L',$1::text,$2::text) AS sql", [rol, clave]);
      await cliente.query(instruccion.rows[0].sql);
    }
    await cliente.query("COMMIT");
  } catch (error) { await cliente.query("ROLLBACK"); throw error; } finally { await cliente.end(); }
}
if (require.main === module) configurarRoles().then(() => console.info("Roles configurados; contraseñas no registradas"))
  .catch(() => { console.error("No se pudieron configurar los roles; verificar acceso administrador y variables"); process.exitCode = 1; });
