import { Pool } from "pg";
export default async function limpiar(): Promise<void> {
  const nombre = process.env.BD_PRUEBAS_NOMBRE;
  if (!nombre || !/^sigecat_prueba_\d+$/.test(nombre)) return;
  const pool = new Pool({ connectionString: process.env.BD_PRUEBAS_ADMIN_URL, max: 1 });
  try { await pool.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`); } finally { await pool.end(); }
}
