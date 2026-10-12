import { Pool } from "pg";
import { aplicarMigraciones } from "../../scripts/migrar";
export default async function preparar(): Promise<void> {
  const url = process.env.BD_PRUEBAS_URL;
  if (!url) throw new Error("Falta BD_PRUEBAS_URL. Levantar docker compose -f api/docker-compose.yml up -d; las pruebas no se omiten.");
  const administracion = new Pool({ connectionString: url, max: 1 });
  const nombre = `sigecat_prueba_${process.pid}`;
  try { await administracion.query(`CREATE DATABASE ${nombre}`); } finally { await administracion.end(); }
  const destino = new URL(url); destino.pathname = `/${nombre}`;
  process.env.BD_PRUEBAS_ADMIN_URL = url;
  process.env.BD_PRUEBAS_NOMBRE = nombre;
  process.env.BD_PRUEBAS_URL = destino.toString();
  const pool = new Pool({ connectionString: destino.toString(), max: 1 });
  const cliente = await pool.connect();
  try { await aplicarMigraciones(cliente); } finally { cliente.release(); await pool.end(); }
}
