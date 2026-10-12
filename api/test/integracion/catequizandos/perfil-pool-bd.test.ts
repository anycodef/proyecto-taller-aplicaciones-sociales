import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { PeticionInscripcion } from "@/lib/catequizandos/contratos";
import { TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";
import { enTransaccion, type Tx } from "../../../src/compartido/bd/transaccion";
import { registrarProveedorResumen } from "../../../src/modulos/catequizandos/dominio/puertos";
import { consultarPerfil } from "../../../src/modulos/catequizandos/aplicacion/perfil";
import { crearInscripcion } from "../../../src/modulos/inscripciones/aplicacion/inscribir";
import { consultarResumenAsistencia } from "../../../src/modulos/asistencia/aplicacion/consultar-faltas";
const esquema = `perfil_pool_${randomUUID().replaceAll("-", "")}`;
let pool: Pool;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (sql: string, parametros: unknown[]) => pool.query(sql, parametros) }));
const cuentaId = randomUUID(), credencialId = randomUUID(), cicloId = randomUUID(), grupoId = randomUUID();
const sesionMisa = randomUUID(), sesionCatequesis = randomUUID();
const contexto: ContextoAcceso = { cuentaId, credencialId, identidadOperativa: "Coordinación prueba pool", rolesPropios: ["coordinacion"], gruposAsignados: [], catequizandosApoderados: [], esMenor: false };
const ninos: string[] = [];
const claveBarrera = randomBytes(4).readUInt32BE() % 2147483647;
beforeAll(async () => {
  if (!process.env.BD_PRUEBAS_URL) throw new Error("Falta BD_PRUEBAS_URL: regresión de pool no se omite");
  pool = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 3, connectionTimeoutMillis: 1500, options: `-c search_path=${esquema},pg_catalog -c statement_timeout=5000` });
  const conexion = await pool.connect();
  try {
    await conexion.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion; SET search_path TO ${esquema},pg_catalog`);
    const carpeta = resolve(__dirname, "../../../migraciones");
    const archivos = (await readdir(carpeta)).filter(a => /^\d{4}_.*\.sql$/.test(a) && !a.startsWith("0001_") && !a.startsWith("0108_")).sort();
    for (const archivo of archivos) await conexion.query((await readFile(resolve(carpeta, archivo), "utf8")).replace(/\bpublic\b/g, esquema));
    await conexion.query(`CREATE FUNCTION esperar_perfiles(clave bigint) RETURNS void LANGUAGE plpgsql AS $$
      DECLARE limite timestamptz := clock_timestamp()+interval '3 seconds';
      BEGIN
        LOOP
          EXIT WHEN (SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid::bigint=clave AND mode='ShareLock' AND granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database()))=3;
          IF clock_timestamp()>limite THEN RAISE EXCEPTION 'barrera_perfiles_incompleta'; END IF;
          PERFORM pg_sleep(0.01);
        END LOOP;
      END $$`);
    await conexion.query("BEGIN");
    await conexion.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Coordinación prueba pool',false)", [cuentaId]);
    await conexion.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'coordinacion')", [cuentaId]);
    await conexion.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'equipo',$3,'activa')", [credencialId, cuentaId, randomBytes(32)]);
    await conexion.query("INSERT INTO ciclo(id,nombre,inicio,fin,estado,abierto_por) VALUES($1,'Ciclo pool','2026-01-01','2026-12-31','abierto',$2)", [cicloId, cuentaId]);
    await conexion.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Grupo pool',8,10,'mixto')", [grupoId, cicloId]);
    process.env.URL_WEB = "https://sigecat.example";
    for (let indice = 0; indice < 3; indice++) {
      const apoderadoId = randomUUID(), ninoId = randomUUID();
      const datos: PeticionInscripcion = {
        id: randomUUID(), nino: { id: ninoId, nombres: `Perfil ${indice}`, apellidos: "Prueba pool", fechaNacimiento: "2016-01-01", sexo: "femenino", bautizado: false }, grupoId, asignacionId: randomUUID(), edadFueraRangoConfirmada: false,
        apoderados: [{ id: randomUUID(), relacion: "madre", apoderado: { id: apoderadoId, nombres: "Familia", apellidos: `Prueba ${indice}`, tipoContacto: "telefono", valorContacto: "999999999", cuentaId: randomUUID(), credencialId: randomUUID() } }],
        consentimiento: { id: randomUUID(), apoderadoId, textoId: "00100000-0000-4000-8000-000000000001", canal: "presencial" }, documentos: TIPOS_DOCUMENTO.map(tipo => ({ id: randomUUID(), tipo }))
      };
      await crearInscripcion(conexion, datos, contexto);
      // La vigencia de la fixture incluye el domingo usado por el resumen histórico real.
      await conexion.query("UPDATE inscripcion SET desde='2026-01-01T00:00:00-05:00' WHERE id=$1", [datos.id]);
      await conexion.query("UPDATE asignacion_grupo SET desde='2026-01-01T00:00:00-05:00' WHERE id=$1", [datos.asignacionId]);
      ninos.push(ninoId);
    }
    await conexion.query("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$3,'2026-01-04','misa'),($2,$3,'2026-01-04','catequesis')", [sesionMisa, sesionCatequesis, cicloId]);
    await conexion.query("COMMIT");
  } catch (error) { await conexion.query("ROLLBACK"); throw error; }
  finally { conexion.release(); }
}, 30000);
afterAll(async () => { if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await pool.end(); } } });
test("RF-201: tres perfiles simultáneos con pool 3 usan el resumen real en su misma transacción sin adquirir conexiones adicionales", async () => {
  const transacciones = new Map<string, Tx>();
  const identidades = new Map<string, { pid: number; transaccion: string; instantanea: string }>();
  let resumenesEsperando = 0;
  let soltarResumenes!: () => void;
  const resumenesEnBarrera = new Promise<void>(resolver => { soltarResumenes = resolver; });
  const proveedor = {
    nombre: "resumenAsistencia",
    async consultar(id: string, ciclo: string, ctx: ContextoAcceso, tx: Tx) {
      expect(tx).toBe(transacciones.get(id));
      expect(ctx).toBe(contexto);
      const identidad = (await tx.query<{ pid: number; transaccion: string; instantanea: string }>("SELECT pg_backend_pid() AS pid,txid_current()::text AS transaccion,txid_current_snapshot()::text AS instantanea")).rows[0];
      expect(identidad).toEqual(identidades.get(id));
      if (++resumenesEsperando === 3) soltarResumenes();
      await resumenesEnBarrera;
      expect(pool.totalCount).toBe(3);
      expect(pool.idleCount).toBe(0);
      expect(pool.waitingCount).toBe(0);
      return consultarResumenAsistencia(id, ciclo, tx);
    }
  };
  registrarProveedorResumen(proveedor);
  const conectar = jest.spyOn(pool, "connect");
  let esperando = 0;
  let soltar!: () => void;
  const todosEnBarrera = new Promise<void>(resolver => { soltar = resolver; });
  try {
    const pendientes = ninos.map(id => enTransaccion(async tx => {
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      transacciones.set(id, tx);
      identidades.set(id, (await tx.query<{ pid: number; transaccion: string; instantanea: string }>("SELECT pg_backend_pid() AS pid,txid_current()::text AS transaccion,txid_current_snapshot()::text AS instantanea")).rows[0]);
      await tx.query("SELECT pg_advisory_xact_lock_shared($1::bigint)", [claveBarrera]);
      await tx.query("SELECT esperar_perfiles($1::bigint)", [claveBarrera]);
      // Conserva los locks hasta que las tres consultas SQL hayan observado el pool ocupado.
      if (++esperando === 3) soltar();
      await todosEnBarrera;
      for (const sesionId of [sesionMisa, sesionCatequesis]) await tx.query("INSERT INTO asistencia(id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,hora_primer_registro,recibido_primer_registro,corregida,conflicto) VALUES($1,$2,$3,$4,'presente','manual',clock_timestamp(),clock_timestamp(),false,false)", [randomUUID(), cicloId, sesionId, id]);
      return consultarPerfil(tx, id, contexto);
    }));
    const perfiles = await Promise.all(pendientes);
    expect(new Set([...identidades.values()].map(i => i.pid)).size).toBe(3);
    expect(conectar).toHaveBeenCalledTimes(3);
    for (const perfil of perfiles) expect(perfil.resumenes.resumenAsistencia).toEqual({ domingos: [{ fecha: "2026-01-04", misa: "presente", catequesis: "presente" }], ausencias: 0, faltas: 0 });
  } finally { soltar(); soltarResumenes(); conectar.mockRestore(); }
});
