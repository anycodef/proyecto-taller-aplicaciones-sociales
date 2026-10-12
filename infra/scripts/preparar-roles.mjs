import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve('api/package.json'));
const { Client } = require('pg');
const cliente = new Client({ connectionString: process.env.BD_ADMIN_URL });
await cliente.connect();
try {
  await cliente.query('BEGIN');
  await cliente.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sigecat_migrador') THEN
        CREATE ROLE sigecat_migrador LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sigecat_api') THEN
        CREATE ROLE sigecat_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sigecat_retencion') THEN
        CREATE ROLE sigecat_retencion NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
    END $$;
    GRANT sigecat_migrador TO administracion;
    ALTER DATABASE sigecat OWNER TO sigecat_migrador;
    ALTER SCHEMA public OWNER TO sigecat_migrador;
    REVOKE ALL ON DATABASE sigecat FROM PUBLIC;
    GRANT CONNECT ON DATABASE sigecat TO sigecat_api, sigecat_migrador;
    GRANT CREATE ON DATABASE sigecat TO sigecat_migrador;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT USAGE, CREATE ON SCHEMA public TO sigecat_migrador;
    GRANT USAGE ON SCHEMA public TO sigecat_api;
    GRANT sigecat_retencion TO sigecat_api;
    GRANT sigecat_retencion TO sigecat_migrador WITH ADMIN OPTION;
  `);
  // PostgreSQL no admite parametros en ALTER ROLE; quote_literal evita interpolar entradas.
  for (const [rol, clave] of [
    ['sigecat_migrador', process.env.BD_MIGRADOR_CLAVE],
    ['sigecat_api', process.env.BD_API_CLAVE],
  ]) {
    if (!clave) throw new Error('Falta una credencial de Key Vault.');
    const resultado = await cliente.query('SELECT quote_literal($1) AS clave', [clave]);
    await cliente.query(`ALTER ROLE ${rol} PASSWORD ${resultado.rows[0].clave}`);
  }
  await cliente.query('COMMIT');
} catch {
  await cliente.query('ROLLBACK');
  throw new Error('No se pudieron preparar los roles PostgreSQL; no se registra SQL ni credenciales.');
} finally {
  await cliente.end();
}
