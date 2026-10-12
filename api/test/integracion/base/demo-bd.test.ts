import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { sembrarDemo } from "../../../scripts/sembrar-demo";
import { cargarContexto } from "../../../src/modulos/seguridad/aplicacion/contexto";

let pool: Pool;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (texto: string, valores: unknown[]) => pool.query(texto, valores) }));
const esquema = `demo_${randomUUID().replaceAll("-", "")}`;
const anterior = process.env.URL_WEB;
beforeAll(async () => {
  process.env.URL_WEB = "https://sigecat.example";
  const administrador = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 1 });
  const cliente = await administrador.connect();
  try {
    await cliente.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion; SET search_path TO ${esquema},pg_catalog`);
    const carpeta = resolve(__dirname, "../../../migraciones");
    for (const archivo of (await readdir(carpeta)).filter(nombre => /^\d{4}_.*\.sql$/.test(nombre) && !nombre.startsWith("0001_")).sort()) {
      await cliente.query((await readFile(resolve(carpeta, archivo), "utf8")).replace(/\bpublic\b/g, esquema));
    }
  } finally { cliente.release(); await administrador.end(); }
  pool = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 3, options: `-c search_path=${esquema},pg_catalog -c role=sigecat_api` });
});
afterAll(async () => {
  if (pool) await pool.end();
  const administrador = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 1 });
  try { await administrador.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await administrador.end(); }
  if (anterior === undefined) delete process.env.URL_WEB; else process.env.URL_WEB = anterior;
});
test("RF-102 RF-110 RF-111: demo crea cinco roles, cuenta mixta, hermanos y enlaces solo una vez", async () => {
  const enlaces = await sembrarDemo();
  expect(enlaces).toHaveLength(8);
  expect(await sembrarDemo()).toEqual([]);
  expect((await pool.query("SELECT DISTINCT rol FROM rol_cuenta ORDER BY rol")).rows.map(fila => fila.rol)).toEqual(["administracion", "catequista", "coordinacion", "familia", "supervision"]);
  expect((await pool.query("SELECT count(*)::integer AS cantidad FROM v_nomina_ciclo")).rows[0].cantidad).toBe(2);
  const mixta = (await pool.query<{ cuenta_id: string; credencial_id: string }>("SELECT c.id cuenta_id,cr.id credencial_id FROM cuenta c JOIN credencial cr ON cr.cuenta_id=c.id WHERE c.identidad_operativa='Cuenta mixta demo' AND cr.tipo='familia'")).rows[0];
  await pool.query("UPDATE credencial SET estado='activa' WHERE id=$1", [mixta.credencial_id]);
  const contexto = await cargarContexto({ cuentaId: mixta.cuenta_id, credencialId: mixta.credencial_id, tipo: "familia" });
  expect(contexto?.rolesPropios).toEqual(["catequista", "familia"]);
  expect(contexto?.gruposAsignados).toHaveLength(1);
  expect(contexto?.catequizandosApoderados).toHaveLength(1);
});
