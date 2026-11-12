import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

/** Esquema propio por archivo: las pruebas de 004 no comparten filas con otras suites. */
export type BdPrueba = { app: Pool; admin: Pool; cerrar(): Promise<void> };

export async function prepararBd(prefijo: string): Promise<BdPrueba> {
  const esquema = `${prefijo}_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 2, options: `-c search_path=${esquema},pg_catalog -c timezone=America/Lima` });
  const cliente = await admin.connect();
  try {
    await cliente.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion; SET search_path TO ${esquema},pg_catalog`);
    const carpeta = resolve(__dirname, "../../../migraciones");
    for (const archivo of (await readdir(carpeta)).filter(nombre => /^\d{4}_.*\.sql$/.test(nombre) && !nombre.startsWith("0001_")).sort()) {
      await cliente.query((await readFile(resolve(carpeta, archivo), "utf8")).replace(/\bpublic\b/g, esquema));
    }
  } finally { cliente.release(); }
  const app = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 3, options: `-c search_path=${esquema},pg_catalog -c timezone=America/Lima -c role=sigecat_api` });
  return {
    app,
    admin,
    async cerrar() {
      await app.end();
      try { await admin.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await admin.end(); }
    },
  };
}

export type Semilla = { cicloId: string; cuentaId: string; apoderadoId: string; catequizandoId: string; hermanoId: string; sesionId: string; sesion2Id: string };

/** Datos mínimos de 001, 002 y 003 que una justificación referencia. */
export async function sembrar(bd: BdPrueba): Promise<Semilla> {
  const s: Semilla = { cicloId: randomUUID(), cuentaId: randomUUID(), apoderadoId: randomUUID(), catequizandoId: randomUUID(), hermanoId: randomUUID(), sesionId: randomUUID(), sesion2Id: randomUUID() };
  const q = (texto: string, valores: unknown[]) => bd.admin.query(texto, valores);
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Coordinación 1',false)", [s.cuentaId]);
  await q("INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,'Ciclo 2026','2026-03-01','2026-12-31',$2)", [s.cicloId, s.cuentaId]);
  for (const id of [s.catequizandoId, s.hermanoId]) await q("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,'Ana','Prueba','2015-01-01','femenino',true,$2)", [id, s.cuentaId]);
  await q("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto) VALUES($1,'Adulto','Prueba','otro','prueba')", [s.apoderadoId]);
  for (const id of [s.catequizandoId, s.hermanoId]) await q("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'madre')", [randomUUID(), id, s.apoderadoId]);
  await q("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,'2026-11-01','misa'),($3,$2,'2026-11-01','catequesis')", [s.sesionId, s.cicloId, s.sesion2Id]);
  return s;
}

/** Ejecuta en una transacción del rol de la aplicación y confirma, como haría enTransaccion. */
export async function enTx<T>(bd: BdPrueba, operacion: (tx: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await bd.app.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await operacion(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally { cliente.release(); }
}
