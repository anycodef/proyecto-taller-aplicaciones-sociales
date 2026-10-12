import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { PeticionInscripcion } from "@/lib/catequizandos/contratos";
import { TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";
import { crearInscripcion, confirmarDuplicado } from "../../../src/modulos/inscripciones/aplicacion/inscribir";
import { anularInscripcion, cambiarDocumento, listarDocumentosPendientes } from "../../../src/modulos/inscripciones/aplicacion/documentos";
import { corregirCatequizando } from "../../../src/modulos/catequizandos/aplicacion/perfil";
import { registrarCondiciones, consultarCondiciones } from "../../../src/modulos/catequizandos/aplicacion/condiciones";
import { asignarGrupo, cerrarGrupo } from "../../../src/modulos/catequizandos/aplicacion/grupos";
import { reemitirCarne } from "../../../src/modulos/catequizandos/aplicacion/carnes";
import { anonimizarCatequizando } from "../../../src/modulos/catequizandos/aplicacion/retencion";
import { fuenteInscripciones } from "../../../src/modulos/catequizandos/aplicacion/consultas";
const esquema = `catequizandos_${randomUUID().replaceAll("-", "")}`;
let pool: Pool, cliente: PoolClient;
const coordinador = randomUUID(), credencialId = randomUUID(), cicloId = randomUUID(), grupoA = randomUUID(), grupoB = randomUUID();
const contexto: ContextoAcceso = { cuentaId: coordinador, credencialId, identidadOperativa: "Coordinación prueba", rolesPropios: ["coordinacion"], gruposAsignados: [], catequizandosApoderados: [], esMenor: false };
beforeAll(async () => {
  if (!process.env.BD_PRUEBAS_URL) throw new Error("Falta BD_PRUEBAS_URL: integración PostgreSQL no se omite");
  pool = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 3, options: `-c search_path=${esquema},pg_catalog` });
  const conexion = await pool.connect();
  try {
    await conexion.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion; SET search_path TO ${esquema},pg_catalog`);
    const carpeta = resolve(__dirname, "../../../migraciones");
    const archivos = (await readdir(carpeta)).filter(a => /^(0002|01\d{2}|02\d{2})_.*\.sql$/.test(a)).sort();
    if (!archivos.some(a => a.startsWith("0002_"))) throw new Error("Falta migración transversal 0002 de ciclo");
    for (const archivo of archivos) await conexion.query((await readFile(resolve(carpeta, archivo), "utf8")).replace(/\bpublic\b/g, esquema));
    await conexion.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Coordinación prueba',false)", [coordinador]);
    await conexion.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'coordinacion')", [coordinador]);
    await conexion.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'equipo',$3,'activa')", [credencialId, coordinador, randomBytes(32)]);
    await conexion.query("INSERT INTO ciclo(id,nombre,inicio,fin,estado,abierto_por) VALUES($1,'Ciclo prueba','2026-01-01','2026-12-31','abierto',$2)", [cicloId, coordinador]);
    await conexion.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$3,'A',8,10,'mixto'),($2,$3,'B',8,10,'mixto')", [grupoA, grupoB, cicloId]);
  } finally { conexion.release(); }
}, 30000);
beforeEach(async () => { cliente = await pool.connect(); await cliente.query(`SET search_path TO ${esquema},pg_catalog; BEGIN`); process.env.URL_WEB = "https://sigecat.example"; });
afterEach(async () => { if (cliente) { await cliente.query("ROLLBACK; RESET ROLE"); cliente.release(); } });
afterAll(async () => { if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await pool.end(); } } });
function nuevaInscripcion(): PeticionInscripcion {
  const apoderadoId = randomUUID();
  return { id: randomUUID(), nino: { id: randomUUID(), nombres: "Ana", apellidos: "Perez", fechaNacimiento: "2016-04-01", sexo: "femenino", bautizado: false }, grupoId: grupoA, asignacionId: randomUUID(), edadFueraRangoConfirmada: false,
    apoderados: [{ id: randomUUID(), relacion: "madre", apoderado: { id: apoderadoId, nombres: "Rosa", apellidos: "Perez", tipoContacto: "telefono", valorContacto: "999999999", cuentaId: randomUUID(), credencialId: randomUUID() } }],
    consentimiento: { id: randomUUID(), apoderadoId, textoId: "00100000-0000-4000-8000-000000000001", canal: "presencial" }, documentos: TIPOS_DOCUMENTO.map(tipo => ({ id: randomUUID(), tipo })) };
}
async function debeFallar(sql: string, parametros: unknown[], codigo: string) {
  await cliente.query("SAVEPOINT prueba");
  await expect(cliente.query(sql, parametros)).rejects.toMatchObject({ code: codigo });
  await cliente.query("ROLLBACK TO SAVEPOINT prueba");
}
async function nomina(id: string) { return (await cliente.query("SELECT * FROM v_nomina_ciclo WHERE catequizando_id=$1", [id])).rows; }
test("RF-201 RF-202 RF-203 RF-204 RF-205 RF-206 RF-207 RF-302: flujo completo atómico con nómina e historial", async () => {
  const datos = nuevaInscripcion(), ninoId = datos.nino.id;
  const alta = await crearInscripcion(cliente, datos, contexto);
  expect(alta.estado).toBe(201);
  if (alta.estado === 409) throw new Error("duplicado_inesperado");
  expect(alta.datos.enlaces).toHaveLength(1);
  const url = new URL(alta.datos.enlaces[0].url);
  expect(url.search).toBe(""); expect(url.hash).toMatch(/^#t=[A-Za-z0-9_-]{43}$/);
  expect((await crearInscripcion(cliente, datos, contexto)).estado).toBe(200);
  expect((await nomina(ninoId))[0].grupo_id).toBe(grupoA);
  const duplicado = await crearInscripcion(cliente, nuevaInscripcion(), contexto);
  expect(duplicado.estado).toBe(409);
  if (duplicado.estado !== 409) throw new Error("duplicado_no_detectado");
  expect(Object.keys(duplicado.datos).sort()).toEqual(["codigo", "referencia"]);
  const confirmado = await confirmarDuplicado(cliente, duplicado.datos.referencia, true, contexto);
  expect(confirmado).toMatchObject({ perfil: { catequizandoId: ninoId } });
  await corregirCatequizando(cliente, ninoId, { datos: { nombres: "Ana Maria" }, cambios: [{ id: randomUUID(), campo: "nombres" }] }, contexto);
  expect((await nomina(ninoId))[0].nombres).toBe("Ana Maria");
  const historia = await cliente.query("SELECT valor_anterior,valor_nuevo,cambiado_por FROM cambio_inscripcion WHERE catequizando_id=$1", [ninoId]);
  expect(historia.rows[0]).toEqual({ valor_anterior: "Ana", valor_nuevo: "Ana Maria", cambiado_por: coordinador });
  await cambiarDocumento(cliente, datos.id, "documento_identidad", { cambioId: randomUUID(), estado: "entregado", fechaEstado: "2026-10-11" }, contexto);
  await cambiarDocumento(cliente, datos.id, "documento_identidad", { cambioId: randomUUID(), estado: "invalido", motivo: "Ilegible", fechaEstado: "2026-10-11" }, contexto);
  expect((await listarDocumentosPendientes(cliente, cicloId)).some((d: { estado: string }) => d.estado === "invalido")).toBe(true);
  await registrarCondiciones(cliente, ninoId, { condiciones: [{ id: randomUUID(), categoria: "otra", nota: "Apoyar con instrucciones cortas" }] }, contexto);
  expect(await consultarCondiciones(cliente, ninoId, contexto)).toHaveLength(1);
  await asignarGrupo(cliente, datos.id, { id: randomUUID(), grupoId: grupoB, cambioId: randomUUID() }, contexto);
  expect((await nomina(ninoId))[0].grupo_id).toBe(grupoB);
  const periodos = await fuenteInscripciones.periodos(cicloId, [ninoId], cliente);
  expect(periodos[0].asignaciones).toHaveLength(2);
  expect(periodos[0].asignaciones[0].hasta).not.toBeNull();
  expect((await reemitirCarne(cliente, ninoId, 1, contexto)).emision).toBe(2);
  expect((await cliente.query("SELECT count(*)::int AS total FROM carne_emision WHERE catequizando_id=$1 AND invalidada_en IS NULL", [ninoId])).rows[0].total).toBe(1);
  await anularInscripcion(cliente, datos.id, { cambioId: randomUUID(), motivo: "Alta por error" }, contexto);
  expect(await nomina(ninoId)).toEqual([]);
  expect((await cliente.query("SELECT id FROM inscripcion WHERE id=$1", [datos.id])).rowCount).toBe(1);
  const reinscripcion: PeticionInscripcion = { ...datos, id: randomUUID(), nino: { ...datos.nino, nombres: "Ana Maria" }, asignacionId: randomUUID(), consentimiento: { ...datos.consentimiento!, id: randomUUID() }, documentos: TIPOS_DOCUMENTO.map(tipo => ({ id: randomUUID(), tipo })), apoderados: [{ id: datos.apoderados[0].id, apoderadoId: datos.consentimiento!.apoderadoId, relacion: "madre" }] };
  expect((await crearInscripcion(cliente, reinscripcion, contexto)).estado).toBe(201);
  expect(await nomina(ninoId)).toHaveLength(1);
  expect((await cliente.query("SELECT id FROM catequizando WHERE id=$1", [ninoId])).rowCount).toBe(1);
});
test("RF-202 RF-206 RF-302: índices parciales impiden dos altas, asignaciones y emisiones vigentes", async () => {
  const datos = nuevaInscripcion(); await crearInscripcion(cliente, datos, contexto);
  await debeFallar("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion) VALUES($1,$2,$3,$4,9,false,'prueba')", [randomUUID(), datos.nino.id, cicloId, datos.consentimiento!.id], "23505");
  await debeFallar("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia) VALUES($1,$2,$3,$4,false)", [randomUUID(), datos.id, grupoB, coordinador], "23505");
  await debeFallar("INSERT INTO carne_emision(catequizando_id,emision,emitida_por) VALUES($1,2,$2)", [datos.nino.id, coordinador], "23505");
  await expect(cerrarGrupo(cliente, grupoA)).rejects.toMatchObject({ estado: 409, codigo: "grupo_con_ninos_activos" });
});
test("RF-202: fallo al final del alta revierte perfil, familia, consentimiento e inscripción", async () => {
  const datos = nuevaInscripcion();
  datos.documentos[1].id = datos.documentos[0].id;
  await cliente.query("SAVEPOINT alta_atomica");
  await expect(crearInscripcion(cliente, datos, contexto)).rejects.toMatchObject({ code: "23505" });
  await cliente.query("ROLLBACK TO SAVEPOINT alta_atomica");
  expect((await cliente.query("SELECT id FROM catequizando WHERE id=$1", [datos.nino.id])).rowCount).toBe(0);
  expect((await cliente.query("SELECT id FROM apoderado WHERE id=$1", [datos.consentimiento!.apoderadoId])).rowCount).toBe(0);
  expect((await cliente.query("SELECT id FROM consentimiento WHERE id=$1", [datos.consentimiento!.id])).rowCount).toBe(0);
  expect((await cliente.query("SELECT id FROM inscripcion WHERE id=$1", [datos.id])).rowCount).toBe(0);
});
test("RF-202: un reintento UUID conflictivo no modifica el alta original", async () => {
  const datos = nuevaInscripcion(); await crearInscripcion(cliente, datos, contexto);
  await expect(crearInscripcion(cliente, { ...datos, nino: { ...datos.nino, nombres: "Otro" } }, contexto)).rejects.toMatchObject({ estado: 409, codigo: "uuid_en_conflicto" });
  expect((await nomina(datos.nino.id))[0].nombres).toBe("Ana");
  expect((await cliente.query("SELECT id FROM inscripcion WHERE catequizando_id=$1", [datos.nino.id])).rowCount).toBe(1);
});
test("RF-203 RF-204 RF-205 RNF-203: historial inmutable, esquema sin archivos y CHECK de condiciones", async () => {
  const datos = nuevaInscripcion(); await crearInscripcion(cliente, datos, contexto);
  const columnas = await cliente.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name IN ('catequizando','documento_inscripcion')", [esquema]);
  expect(columnas.rows.some(c => /dni|archivo|url|imagen/.test(c.column_name) || c.data_type === "bytea")).toBe(false);
  await debeFallar("INSERT INTO condicion_catequizando(id,catequizando_id,categoria,registrado_por) VALUES($1,$2,'diagnostico',$3)", [randomUUID(), datos.nino.id, coordinador], "23514");
  await debeFallar("INSERT INTO condicion_catequizando(id,catequizando_id,categoria,nota,registrado_por) VALUES($1,$2,'otra',$3,$4)", [randomUUID(), datos.nino.id, "a".repeat(201), coordinador], "22001");
  await debeFallar("UPDATE documento_inscripcion SET estado='invalido',motivo=NULL WHERE inscripcion_id=$1", [datos.id], "23514");
  await corregirCatequizando(cliente, datos.nino.id, { datos: { nombres: "Ana Maria" }, cambios: [{ id: randomUUID(), campo: "nombres" }] }, contexto);
  await cliente.query("SET LOCAL ROLE sigecat_api");
  await debeFallar("DELETE FROM cambio_inscripcion WHERE catequizando_id=$1", [datos.nino.id], "42501");
});
test("RF-106 RF-205 RF-207: retiro borra restringidos e historial y conserva apoderado de hermano", async () => {
  const datos = nuevaInscripcion(); await crearInscripcion(cliente, datos, contexto);
  const hermano = { ...nuevaInscripcion(), nino: { ...datos.nino, id: randomUUID(), nombres: "Luis", sexo: "masculino" as const }, apoderados: [{ id: randomUUID(), apoderadoId: datos.consentimiento!.apoderadoId, relacion: "madre" as const }] };
  hermano.consentimiento = { ...hermano.consentimiento!, apoderadoId: datos.consentimiento!.apoderadoId };
  await crearInscripcion(cliente, hermano, contexto);
  await registrarCondiciones(cliente, datos.nino.id, { condiciones: [{ id: randomUUID(), categoria: "otra" }] }, contexto);
  await cliente.query("SET LOCAL ROLE sigecat_retencion; SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
  await anonimizarCatequizando(datos.nino.id, cliente);
  expect((await cliente.query("SELECT nombres,estado,clave_duplicado FROM catequizando WHERE id=$1", [datos.nino.id])).rows[0]).toEqual({ nombres: "", estado: "anonimizado", clave_duplicado: null });
  expect((await cliente.query("SELECT id FROM documento_inscripcion WHERE inscripcion_id=$1", [datos.id])).rowCount).toBe(0);
  expect((await cliente.query("SELECT id FROM condicion_catequizando WHERE catequizando_id=$1", [datos.nino.id])).rowCount).toBe(0);
  expect((await cliente.query("SELECT nombres FROM apoderado WHERE id=$1", [datos.consentimiento!.apoderadoId])).rows[0].nombres).toBe("Rosa");
  expect(await nomina(datos.nino.id)).toEqual([]);
  expect(await nomina(hermano.nino.id)).toHaveLength(1);
});
test("RF-302: reemisiones concurrentes del mismo reintento conservan una emisión vigente", async () => {
  const datos = nuevaInscripcion(); datos.nino.nombres = `Concurrencia ${randomUUID()}`;
  const preparar = await pool.connect();
  try { await preparar.query("BEGIN"); await crearInscripcion(preparar, datos, contexto); await preparar.query("COMMIT"); }
  catch (error) { await preparar.query("ROLLBACK"); throw error; }
  finally { preparar.release(); }
  async function reemitir() {
    const conexion = await pool.connect();
    try { await conexion.query("BEGIN"); const carne = await reemitirCarne(conexion, datos.nino.id, 1, contexto); await conexion.query("COMMIT"); return carne.emision; }
    catch (error) { await conexion.query("ROLLBACK"); throw error; }
    finally { conexion.release(); }
  }
  expect(await Promise.all([reemitir(), reemitir()])).toEqual([2, 2]);
  expect((await cliente.query("SELECT count(*)::int AS total FROM carne_emision WHERE catequizando_id=$1 AND invalidada_en IS NULL", [datos.nino.id])).rows[0].total).toBe(1);
  expect((await cliente.query("SELECT max(emision) AS emision FROM carne_emision WHERE catequizando_id=$1", [datos.nino.id])).rows[0].emision).toBe(2);
});
test("RF-106 RF-207: retiro del último hijo anonimiza identidad exclusivamente familiar y termina su enlace", async () => {
  const datos = nuevaInscripcion(); await crearInscripcion(cliente, datos, contexto);
  const a = datos.apoderados[0].apoderado!;
  await cliente.query("UPDATE cuenta SET identidad_operativa='Nombre personal antiguo' WHERE id=$1", [a.cuentaId]);
  await cliente.query("INSERT INTO identidad_real(cuenta_id,nombres,apellidos) VALUES($1,'Nombre familiar','Apellido familiar')", [a.cuentaId]);
  await cliente.query("SET LOCAL ROLE sigecat_retencion; SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
  await anonimizarCatequizando(datos.nino.id, cliente);
  const cuenta = (await cliente.query("SELECT identidad_operativa FROM cuenta WHERE id=$1", [a.cuentaId])).rows[0];
  expect(cuenta.identidad_operativa).toBe(`Familia retirada ${a.cuentaId}`);
  expect((await cliente.query("SELECT nombres,apellidos,valor_contacto FROM apoderado WHERE id=$1", [a.id])).rows[0]).toEqual({ nombres: "", apellidos: "", valor_contacto: "retirado" });
  expect((await cliente.query("SELECT estado FROM credencial WHERE id=$1", [a.credencialId])).rows[0].estado).toBe("terminada");
  expect((await cliente.query("SELECT cuenta_id FROM identidad_real WHERE cuenta_id=$1", [a.cuentaId])).rowCount).toBe(0);
});
test("RF-106 RF-105 RF-207: retirar hijo de una cuenta mixta conserva identidad del equipo y credencial de equipo", async () => {
  const datos = nuevaInscripcion(); await crearInscripcion(cliente, datos, contexto);
  const a = datos.apoderados[0].apoderado!, credencialEquipo = randomUUID();
  await cliente.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'catequista')", [a.cuentaId]);
  await cliente.query("UPDATE cuenta SET identidad_operativa='Luz operativa' WHERE id=$1", [a.cuentaId]);
  await cliente.query("INSERT INTO identidad_real(cuenta_id,nombres,apellidos) VALUES($1,'Nombre del equipo','Apellido del equipo')", [a.cuentaId]);
  await cliente.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'equipo',$3,'activa')", [credencialEquipo, a.cuentaId, randomBytes(32)]);
  await cliente.query("SET LOCAL ROLE sigecat_retencion; SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
  await anonimizarCatequizando(datos.nino.id, cliente);
  expect((await cliente.query("SELECT identidad_operativa FROM cuenta WHERE id=$1", [a.cuentaId])).rows[0].identidad_operativa).toBe("Luz operativa");
  expect((await cliente.query("SELECT estado FROM credencial WHERE id=$1", [credencialEquipo])).rows[0].estado).toBe("activa");
  expect((await cliente.query("SELECT cuenta_id FROM identidad_real WHERE cuenta_id=$1", [a.cuentaId])).rowCount).toBe(1);
  expect((await cliente.query("SELECT estado FROM credencial WHERE id=$1", [a.credencialId])).rows[0].estado).toBe("terminada");
});
test("RF-106 RF-201: rol o contexto aislados no anonimizan y retención no borra perfil de ciclo vigente", async () => {
  const datos = nuevaInscripcion(); await crearInscripcion(cliente, datos, contexto);
  await cliente.query("SELECT set_config('sigecat.contexto','retencion',true)");
  await expect(anonimizarCatequizando(datos.nino.id, cliente)).rejects.toMatchObject({ estado: 403 });
  await cliente.query("SET LOCAL ROLE sigecat_retencion; SELECT set_config('sigecat.contexto','',true)");
  await expect(anonimizarCatequizando(datos.nino.id, cliente)).rejects.toMatchObject({ estado: 403 });
  await cliente.query("SELECT set_config('sigecat.contexto','retencion',true)");
  await expect(anonimizarCatequizando(datos.nino.id, cliente)).rejects.toMatchObject({ estado: 409, codigo: "perfil_aun_necesario" });
  expect((await cliente.query("SELECT nombres,estado FROM catequizando WHERE id=$1", [datos.nino.id])).rows[0]).toEqual({ nombres: "Ana", estado: "vigente" });
  expect((await cliente.query("SELECT id FROM documento_inscripcion WHERE inscripcion_id=$1", [datos.id])).rowCount).toBe(5);
});
test("RF-207 RF-110: cuenta familiar usa UUID cliente, token compartido y URL canónica sin nombres ni query", async () => {
  const datos = nuevaInscripcion(), a = datos.apoderados[0].apoderado!;
  process.env.URL_WEB = "https://sigecat.example/ruta-anterior?clave=no_debe_salir#fragmento-anterior";
  const alta = await crearInscripcion(cliente, datos, contexto);
  if (alta.estado === 409) throw new Error("duplicado_inesperado");
  const url = new URL(alta.datos.enlaces[0].url);
  expect(url.pathname).toBe("/acceso/familia"); expect(url.search).toBe("");
  expect(url.hash).toMatch(/^#t=[A-Za-z0-9_-]{43}$/);
  expect(url.toString()).not.toMatch(/Rosa|Perez|ruta-anterior|fragmento-anterior|no_debe_salir/);
  const cuenta = (await cliente.query("SELECT id,identidad_operativa FROM cuenta WHERE id=$1", [a.cuentaId])).rows[0];
  expect(cuenta).toEqual({ id: a.cuentaId, identidad_operativa: `Familia ${a.id}` });
  const credencial = (await cliente.query("SELECT id,tipo,octet_length(token_hash) AS largo FROM credencial WHERE cuenta_id=$1", [a.cuentaId])).rows[0];
  expect(credencial).toEqual({ id: a.credencialId, tipo: "familia", largo: 32 });
  const columnas = (await cliente.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='credencial'", [esquema])).rows.map(f => f.column_name);
  expect(columnas).not.toContain("token");
  const repetido = await crearInscripcion(cliente, datos, contexto);
  expect(repetido.estado).toBe(200);
  if (repetido.estado === 409) throw new Error("duplicado_inesperado");
  expect(repetido.datos.enlaces).toEqual([]);
});
