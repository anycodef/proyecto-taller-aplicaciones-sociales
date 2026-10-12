import { Pool, type PoolClient } from "pg";
import { CATALOGO, COLUMNAS_TECNICAS, PROYECCIONES_LOCALES, TABLAS_INFRAESTRUCTURA, camposSinCatalogar, validarCoberturaCatalogo, validarProyeccionLocal, type CampoEsquema } from "@/lib/seguridad/catalogo-datos";

let pool: Pool;
let cliente: PoolClient;
beforeAll(async () => {
  if (!process.env.BD_PRUEBAS_URL) throw new Error("Falta BD_PRUEBAS_URL; la cobertura de esquema requiere migraciones reales y no se omite");
  pool = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 1 });
});
beforeEach(async () => { cliente = await pool.connect(); await cliente.query("BEGIN"); });
afterEach(async () => { if (cliente) { await cliente.query("ROLLBACK"); cliente.release(); } });
afterAll(async () => { if (pool) await pool.end(); });
async function columnasReales(): Promise<CampoEsquema[]> {
  const resultado = await cliente.query<CampoEsquema>(`SELECT c.table_name entidad,c.column_name campo FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND t.table_type='BASE TABLE' ORDER BY c.table_name,c.ordinal_position`);
  return resultado.rows;
}

test("RF-107: cada columna física 001–003 y transversal tiene finalidad o excepción técnica explícita tras migraciones reales", async () => {
  const columnas = await columnasReales();
  expect(new Set(columnas.map(c => c.entidad)).size).toBeGreaterThan(20);
  expect(columnas).toEqual(expect.arrayContaining([{ entidad: "condicion_catequizando", campo: "categoria" }, { entidad: "documento_inscripcion", campo: "estado" }, { entidad: "esquema_migracion", campo: "checksum_sha256" }]));
  expect(camposSinCatalogar(columnas)).toEqual([]);
  expect(() => validarCoberturaCatalogo(columnas)).not.toThrow();
  const claves = new Set(columnas.map(c => `${c.entidad}.${c.campo}`));
  for (const entrada of CATALOGO) expect(claves.has(`${entrada.entidad}.${entrada.campo}`)).toBe(true);
  for (const [entidad, campos] of Object.entries(COLUMNAS_TECNICAS)) for (const campo of campos) expect(claves.has(`${entidad}.${campo}`)).toBe(true);
  expect(TABLAS_INFRAESTRUCTURA).toEqual(["esquema_migracion"]);
});

test("RF-107: añadir una columna personal desconocida al esquema real hace fallar cobertura", async () => {
  await cliente.query("ALTER TABLE public.catequizando ADD COLUMN diagnostico_nuevo text");
  const columnas = await columnasReales();
  expect(camposSinCatalogar(columnas)).toEqual([{ entidad: "catequizando", campo: "diagnostico_nuevo" }]);
  expect(() => validarCoberturaCatalogo(columnas)).toThrow("campos_sin_catalogar:catequizando.diagnostico_nuevo");
});

test("RF-107: UUID y timestamp nuevos no se exceptúan automáticamente por tipo o sufijo", async () => {
  await cliente.query("ALTER TABLE public.catequizando ADD COLUMN documento_nuevo_id uuid, ADD COLUMN diagnostico_en timestamptz");
  const columnas = await columnasReales();
  expect(camposSinCatalogar(columnas)).toEqual([{ entidad: "catequizando", campo: "documento_nuevo_id" }, { entidad: "catequizando", campo: "diagnostico_en" }]);
  expect(() => validarCoberturaCatalogo(columnas)).toThrow("campos_sin_catalogar");
});

test("RNF-101 RF-105: cada fuente de proyección offline existe físicamente y excluye datos restringidos por entidad", async () => {
  const claves = new Set((await columnasReales()).map(c => `${c.entidad}.${c.campo}`));
  for (const [coleccion, campos] of Object.entries(PROYECCIONES_LOCALES)) {
    expect(() => validarProyeccionLocal(coleccion, Object.keys(campos))).not.toThrow();
    for (const fuente of Object.values(campos)) expect(claves.has(`${fuente.entidad}.${fuente.campo}`)).toBe(true);
  }
});
