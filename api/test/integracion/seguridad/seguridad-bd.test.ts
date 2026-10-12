import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { hashToken, generarToken } from "../../../src/modulos/seguridad/dominio/tokens";
import { cargarContexto } from "../../../src/modulos/seguridad/aplicacion/contexto";
import { registrarConsentimiento } from "../../../src/modulos/seguridad/aplicacion/consentimientos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { configurarBorradorBlobs, registrarParticipanteRetencion, retirarConsentimiento } from "../../../src/modulos/seguridad/aplicacion/motor-retencion";
import { entrar, renovar, reportarBloqueo } from "../../../src/modulos/seguridad/aplicacion/acceso";
import { verificarJwt, firmarJwt } from "../../../src/modulos/seguridad/infraestructura/firmador-jwt";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { manejadoresSeguridad } from "../../../src/modulos/seguridad/http";
const esquema = `seguridad_${randomUUID().replaceAll("-", "")}`;
let pool: Pool;
let cliente: PoolClient;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (sql: string, valores: unknown[]) => pool.query(sql, valores) }));
const administrador = randomUUID(), segundoAdministrador = randomUUID(), catequista = randomUUID(), credencial = randomUUID(), credencialAdministrador = randomUUID(), dispositivo = randomUUID();
const cicloAbierto = randomUUID();
beforeAll(async () => {
  const url = process.env.BD_PRUEBAS_URL;
  if (!url) throw new Error("Falta BD_PRUEBAS_URL: levantar PostgreSQL de api/docker-compose.yml; integración no se omite");
  pool = new Pool({ connectionString: url, max: 3, options: `-c search_path=${esquema},pg_catalog` });
  const conexion = await pool.connect();
  try {
    await conexion.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion; SET search_path TO ${esquema},pg_catalog`);
    // Aislamiento de esquema sin alterar los SQL versionados; las funciones conservan search_path fijo.
    for (const archivo of ["0002_ciclo_base.sql", "0101_cuentas_y_credenciales.sql", "0102_auditoria.sql", "0103_delegacion.sql", "0104_consentimiento.sql", "0105_retencion.sql", "0106_aviso_coordinacion.sql", "0107_aviso_grupo.sql", "0108_membresia_retencion.sql", "0202_crear_grupos.sql"]) {
      const sql = (await readFile(resolve(__dirname, "../../../migraciones", archivo), "utf8")).replace(/\bpublic\b/g, esquema);
      await conexion.query(sql);
    }
    // Ciclos y grupos usan migraciones reales; el puerto familiar sigue aislado de la inscripción de 002.
    await conexion.query("CREATE TABLE apoderado(id uuid PRIMARY KEY,cuenta_id uuid); CREATE TABLE vinculo_apoderado(apoderado_id uuid,catequizando_id uuid,vigente_desde timestamptz,vigente_hasta timestamptz)");
    await conexion.query("GRANT SELECT,INSERT,UPDATE,DELETE ON grupo_catequista,apoderado,vinculo_apoderado TO sigecat_retencion");
    await conexion.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'ADM prueba uno',false),($2,'ADM prueba dos',false),($3,'Luz 3',true)", [administrador, segundoAdministrador, catequista]);
    await conexion.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'administracion'),($1,'coordinacion'),($2,'administracion'),($3,'catequista')", [administrador, segundoAdministrador, catequista]);
    await conexion.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado,dispositivo_id) VALUES($1,$2,'equipo',$3,'activa',$4)", [credencial, catequista, hashToken(generarToken()), dispositivo]);
    await conexion.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado,dispositivo_id) VALUES($1,$2,'equipo',$3,'activa',$4)", [credencialAdministrador, administrador, hashToken(generarToken()), randomUUID()]);
    await conexion.query("INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,'Ciclo de seguridad','2026-01-01','2026-12-31',$2)", [cicloAbierto, administrador]);
  } finally { conexion.release(); }
}, 30000);
beforeEach(async () => {
  cliente = await pool.connect();
  await cliente.query(`SET search_path TO ${esquema},pg_catalog; BEGIN`);
});
afterEach(async () => { if (cliente) { await cliente.query("ROLLBACK; RESET ROLE"); cliente.release(); } });
afterAll(async () => {
  if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await pool.end(); } }
});
async function debeFallar(sql: string, valores: unknown[], codigo: string): Promise<void> {
  await cliente.query("SAVEPOINT prueba");
  await expect(cliente.query(sql, valores)).rejects.toMatchObject({ code: codigo });
  await cliente.query("ROLLBACK TO SAVEPOINT prueba");
}
test("RF-111: índice permite solo una credencial vigente por cuenta y tipo", async () => {
  await debeFallar("INSERT INTO credencial(cuenta_id,tipo,token_hash) VALUES($1,'equipo',$2)", [catequista, hashToken(generarToken())], "23505");
  await cliente.query("UPDATE credencial SET estado='terminada',motivo_fin='reemision' WHERE id=$1", [credencial]);
  await expect(cliente.query("INSERT INTO credencial(cuenta_id,tipo,token_hash) VALUES($1,'equipo',$2)", [catequista, hashToken(generarToken())])).resolves.toMatchObject({ rowCount: 1 });
});
test("RF-102: último ADM no puede perder rol ni desactivarse", async () => {
  await cliente.query("UPDATE cuenta SET activa=false WHERE id=$1", [segundoAdministrador]);
  await debeFallar("DELETE FROM rol_cuenta WHERE cuenta_id=$1 AND rol='administracion'", [administrador], "23514");
  await debeFallar("UPDATE cuenta SET activa=false WHERE id=$1", [administrador], "23514");
});
test("RF-105: API no tiene SELECT directo; función verifica ADM y COORD solo escribe", async () => {
  const coordinador = randomUUID();
  await cliente.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'COORD prueba',false)", [coordinador]);
  await cliente.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'coordinacion')", [coordinador]);
  await cliente.query("SET LOCAL ROLE sigecat_api");
  await debeFallar("SELECT * FROM identidad_real", [], "42501");
  await cliente.query("SELECT guardar_identidad_real($1,$2,'Nombre','Real',NULL)", [coordinador, catequista]);
  await debeFallar("SELECT * FROM leer_identidad_real($1,$2)", [coordinador, catequista], "42501");
  const real = await cliente.query("SELECT * FROM leer_identidad_real($1,$2)", [administrador, catequista]);
  expect(real.rows[0]).toMatchObject({ nombres: "Nombre", apellidos: "Real" });
});
test("RF-109: API no modifica auditoría y retención requiere rol y contexto", async () => {
  const evento = (await cliente.query<{ id: string }>("INSERT INTO evento_auditoria(accion,resultado) VALUES('prueba','permitido') RETURNING id")).rows[0]!.id;
  await cliente.query("SET LOCAL ROLE sigecat_api");
  await debeFallar("UPDATE evento_auditoria SET accion='cambio' WHERE id=$1", [evento], "42501");
  await debeFallar("DELETE FROM evento_auditoria WHERE id=$1", [evento], "42501");
  await cliente.query("SET LOCAL ROLE sigecat_retencion");
  await debeFallar("UPDATE evento_auditoria SET detalle='{}' WHERE id=$1", [evento], "42501");
  await cliente.query("SELECT set_config('sigecat.contexto','retencion',true)");
  expect((await cliente.query("UPDATE evento_auditoria SET detalle='{}' WHERE id=$1", [evento])).rowCount).toBe(1);
});
test("RF-101 RF-102 RF-104: contexto una consulta con grupos de ciclo abierto, hijos y delegación; revocación inmediata", async () => {
  const grupoA = randomUUID(), grupoB = randomUUID(), grupoHistorico = randomUUID(), cicloCerrado = randomUUID(), apoderado = randomUUID(), hijo = randomUUID(), delegacion = randomUUID();
  await cliente.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$3,'Grupo A',8,13,'mixto'),($2,$3,'Grupo B',8,13,'mixto')", [grupoA, grupoB, cicloAbierto]);
  await cliente.query("INSERT INTO ciclo(id,nombre,inicio,fin,estado,abierto_por,cerrado_en) VALUES($1,'Ciclo histórico','2025-01-01','2025-12-31','cerrado',$2,now()-interval '1 day')", [cicloCerrado, administrador]);
  // El grupo nació antes del cierre; la fixture usa el mismo permiso excepcional exigido por BD.
  await cliente.query("SET LOCAL ROLE sigecat_retencion; SET LOCAL sigecat.contexto='retencion'");
  await cliente.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Grupo histórico',8,13,'mixto')", [grupoHistorico, cicloCerrado]);
  await cliente.query("RESET ROLE; SET LOCAL sigecat.contexto=''");
  for (const grupoId of [grupoA, grupoB, grupoHistorico]) await cliente.query("INSERT INTO grupo_catequista(id,cuenta_id,grupo_id,desde) VALUES($1,$2,$3,now()-interval '1 day')", [randomUUID(), catequista, grupoId]);
  await cliente.query("INSERT INTO apoderado VALUES($1,$2)", [apoderado, catequista]);
  await cliente.query("INSERT INTO vinculo_apoderado VALUES($1,$2,now()-interval '1 day',NULL)", [apoderado, hijo]);
  await cliente.query("INSERT INTO delegacion(id,delegante_id,delegado_id,desde,hasta) VALUES($1,$2,$3,now()-interval '1 day',now()+interval '1 day')", [delegacion, administrador, catequista]);
  const datos = { cuentaId: catequista, credencialId: credencial, tipo: "equipo" as const, dispositivoId: dispositivo };
  const ctx = await cargarContexto(datos, cliente);
  expect(ctx?.gruposAsignados.sort()).toEqual([grupoA, grupoB].sort());
  expect(ctx?.gruposAsignados).not.toContain(grupoHistorico);
  expect(ctx?.catequizandosApoderados).toEqual([hijo]);
  expect(ctx?.delegacionVigente?.id).toBe(delegacion);
  await cliente.query("UPDATE delegacion SET revocada_en=now() WHERE id=$1", [delegacion]);
  expect((await cargarContexto(datos, cliente))?.delegacionVigente).toBeUndefined();
  expect(await cargarContexto({ ...datos, dispositivoId: randomUUID() }, cliente)).toBeNull();
  await cliente.query("UPDATE credencial SET estado='terminada' WHERE id=$1", [credencial]);
  expect(await cargarContexto(datos, cliente)).toBeNull();
});
test("RF-106: consentimiento exige vínculo/texto vigente e idempotencia estricta", async () => {
  const apoderado = randomUUID(), hijo = randomUUID(), id = randomUUID();
  await cliente.query("INSERT INTO apoderado VALUES($1,$2)", [apoderado, catequista]);
  await cliente.query("INSERT INTO vinculo_apoderado VALUES($1,$2,clock_timestamp(),NULL)", [apoderado, hijo]);
  const ctx: ContextoAcceso = { cuentaId: administrador, credencialId: credencialAdministrador, identidadOperativa: "ADM", rolesPropios: ["administracion", "coordinacion"], esMenor: false, gruposAsignados: [], catequizandosApoderados: [] };
  const texto = randomUUID();
  await cliente.query("INSERT INTO texto_consentimiento VALUES($1,'prueba-consentimiento','Constancia sacramental sin vencimiento',sha256(convert_to('prueba','UTF8')),clock_timestamp(),true)", [texto]);
  const datos = { id, catequizandoId: hijo, apoderadoId: apoderado, textoId: texto, canal: "presencial" as const };
  expect((await registrarConsentimiento(cliente, datos, ctx)).creado).toBe(true);
  expect((await registrarConsentimiento(cliente, datos, ctx)).creado).toBe(false);
  await expect(registrarConsentimiento(cliente, { ...datos, canal: "enlace" }, ctx)).rejects.toMatchObject({ estado: 422 });
});
test("RF-101 RF-102 RF-105 RF-107: HTTP real devuelve 401, audita 403 y valida 422 sin revelar identidad real", async () => {
  const entorno = { ...process.env };
  process.env.JWT_CLAVE = "j".repeat(32); process.env.JWT_KID = "prueba"; delete process.env.JWT_CLAVES;
  try {
    const dispositivoAdmin = (await pool.query("SELECT dispositivo_id FROM credencial WHERE id=$1", [credencialAdministrador])).rows[0].dispositivo_id as string;
    const tokenAdmin = await firmarJwt({ cuentaId: administrador, credencialId: credencialAdministrador, tipo: "equipo", dispositivoId: dispositivoAdmin });
    const tokenCat = await firmarJwt({ cuentaId: catequista, credencialId: credencial, tipo: "equipo", dispositivoId: dispositivo });
    const req = (jwt?: string, cuerpo?: unknown) => new HttpRequest({ method: cuerpo ? "POST" : "GET", url: "https://api.test/api/cuentas", headers: { ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), "content-type": "application/json" }, ...(cuerpo ? { body: { string: JSON.stringify(cuerpo) } } : {}) });
    const inv = new InvocationContext({ functionName: "cuentasPrueba" });
    expect(await manejadoresSeguridad.listarCuentas(req(), inv)).toMatchObject({ status: 401, jsonBody: { codigo: "acceso_denegado" } });
    expect(await manejadoresSeguridad.listarCuentas(req(tokenCat), inv)).toMatchObject({ status: 403, jsonBody: { codigo: "fuera_de_alcance" } });
    const denegados = await pool.query("SELECT id FROM evento_auditoria WHERE cuenta_id=$1 AND accion='cuentas:gestionar' AND resultado='denegado'", [catequista]);
    expect(denegados.rowCount).toBeGreaterThan(0);
    expect(await manejadoresSeguridad.crearCuenta(req(tokenAdmin, { id: randomUUID(), identidadOperativa: "Prueba", esMenor: false, roles: ["catequista"], correo: "ajeno" }), inv)).toMatchObject({ status: 422 });
    const resultado = await manejadoresSeguridad.listarCuentas(req(tokenAdmin), inv);
    expect(resultado.status).toBe(200);
    expect(resultado.headers).toEqual({ "Cache-Control": "no-store" });
    for (const cuenta of (resultado.jsonBody as { cuentas: Record<string, unknown>[] }).cuentas) {
      expect(cuenta).toHaveProperty("identidadOperativa");
      expect(cuenta).not.toHaveProperty("identidadReal");
      expect(cuenta).not.toHaveProperty("nombres");
      expect(cuenta).not.toHaveProperty("apellidos");
    }
  } finally { process.env = entorno; }
});
test("RF-106 RF-108: retiro atómico, rollback de participantes y blobs solo después del commit", async () => {
  const hijo = randomUUID(), apoderado = randomUUID(), consentimiento = randomUUID();
  await pool.query("INSERT INTO apoderado VALUES($1,$2)", [apoderado, catequista]);
  await pool.query("INSERT INTO vinculo_apoderado VALUES($1,$2,clock_timestamp(),NULL)", [apoderado, hijo]);
  await pool.query("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, hijo, apoderado, administrador]);
  let fallar = true;
  registrarParticipanteRetencion({ nombre: "catequizandos", tablas: ["vinculo_apoderado", "consentimiento", "evento_auditoria"], async alRetirarConsentimiento(id, tx) {
    const rol = (await tx.query("SELECT current_user rol,current_setting('sigecat.contexto') contexto")).rows[0];
    expect(rol).toEqual({ rol: "sigecat_retencion", contexto: "retiro_consentimiento" });
    await tx.query("UPDATE vinculo_apoderado SET vigente_hasta=clock_timestamp() WHERE catequizando_id=$1", [id]);
    return { blobs: [{ contenedor: "evidencias", ruta: "prueba" }] };
  }, async alVencerCiclo() { return { blobs: [] }; } });
  registrarParticipanteRetencion({ nombre: "evidencias-prueba", async alRetirarConsentimiento() { if (fallar) throw new Error("participante_no_disponible"); return { blobs: [] }; }, async alVencerCiclo() { return { blobs: [] }; } });
  const ctx: ContextoAcceso = { cuentaId: administrador, credencialId: credencialAdministrador, identidadOperativa: "ADM", rolesPropios: ["administracion", "coordinacion"], esMenor: false, gruposAsignados: [], catequizandosApoderados: [] };
  await expect(retirarConsentimiento(consentimiento, ctx)).rejects.toThrow("participante_no_disponible");
  expect((await pool.query("SELECT retirado_en FROM consentimiento WHERE id=$1", [consentimiento])).rows[0].retirado_en).toBeNull();
  expect((await pool.query("SELECT vigente_hasta FROM vinculo_apoderado WHERE catequizando_id=$1", [hijo])).rows[0].vigente_hasta).toBeNull();
  expect((await pool.query("SELECT id FROM ejecucion_retencion WHERE objetivo_id=$1", [hijo])).rowCount).toBe(0);
  fallar = false;
  const borrados: string[] = [];
  configurarBorradorBlobs({ async borrar(ref) {
    const confirmado = await pool.query("SELECT completada_en FROM ejecucion_retencion WHERE objetivo_id=$1", [hijo]);
    expect(confirmado.rows[0].completada_en).not.toBeNull();
    borrados.push(ref.ruta);
  } });
  const resultado = await retirarConsentimiento(consentimiento, ctx);
  expect(borrados).toEqual(["prueba"]);
  expect((await pool.query("SELECT completado_en FROM borrado_blob_pendiente WHERE ejecucion_id=$1", [resultado.ejecucionId])).rows[0].completado_en).not.toBeNull();
  await retirarConsentimiento(consentimiento, ctx);
  expect(borrados).toHaveLength(1);
});
test("RF-101 RF-110 RF-111 RF-112: acceso ligado al dispositivo, renovación concurrente y rechazo conocido auditado por cantidad", async () => {
  const anterior = { jwt: process.env.JWT_CLAVE, kid: process.env.JWT_KID, claves: process.env.JWT_CLAVES, renovacion: process.env.RENOVACION_CLAVE };
  process.env.JWT_CLAVE = "j".repeat(32); process.env.JWT_KID = "prueba"; delete process.env.JWT_CLAVES; process.env.RENOVACION_CLAVE = "r".repeat(32);
  try {
    const cuenta = randomUUID(), enlace = generarToken(), celular = randomUUID(), idCredencial = randomUUID();
    await pool.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,$2,false)", [cuenta, `Equipo ${cuenta}`]);
    await pool.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'catequista')", [cuenta]);
    await pool.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash) VALUES($1,$2,'equipo',$3)", [idCredencial, cuenta, hashToken(enlace)]);
    const activada = await entrar(enlace, "equipo", celular);
    expect((await verificarJwt(activada.jwt))?.dispositivoId).toBe(celular);
    await expect(entrar(enlace, "equipo", randomUUID())).rejects.toMatchObject({ estado: 401, codigo: "acceso_denegado" });
    const [primera, reintento] = await Promise.all([renovar(activada.tokenRenovacion!, celular), renovar(activada.tokenRenovacion!, celular)]);
    expect(primera.tokenRenovacion).toBe(reintento.tokenRenovacion);
    const siguiente = await renovar(primera.tokenRenovacion!, celular);
    await expect(renovar(activada.tokenRenovacion!, celular)).rejects.toMatchObject({ codigo: "acceso_denegado" });
    await pool.query("UPDATE sesion_renovacion SET expira_en=now()-interval '15 days' WHERE credencial_id=$1", [idCredencial]);
    const reconectada = await renovar(siguiente.tokenRenovacion!, celular);
    expect(reconectada.tokenRenovacion).not.toBe(siguiente.tokenRenovacion);
    await reportarBloqueo(reconectada.tokenRenovacion!, celular);
    await expect(renovar(reconectada.tokenRenovacion!, celular, 3)).rejects.toMatchObject({ codigo: "credencial_terminada" });
    await expect(renovar(reconectada.tokenRenovacion!, celular, 3)).rejects.toMatchObject({ codigo: "credencial_terminada" });
    const avisos = await pool.query("SELECT cantidad FROM aviso_coordinacion WHERE cuenta_relacionada_id=$1", [cuenta]);
    expect(avisos.rows).toEqual([{ cantidad: 3 }]);
    await expect(renovar(generarToken(), celular, 9)).rejects.toMatchObject({ codigo: "acceso_denegado" });
    expect((await pool.query("SELECT id FROM aviso_coordinacion WHERE cantidad=9")).rowCount).toBe(0);
    const familiar = randomUUID(), enlaceFamilia = generarToken();
    await pool.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,$2,false)", [familiar, `Familia ${familiar}`]);
    await pool.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'familia')", [familiar]);
    const apoderadoFamilia = randomUUID();
    await pool.query("INSERT INTO apoderado VALUES($1,$2)", [apoderadoFamilia, familiar]);
    await pool.query("INSERT INTO vinculo_apoderado VALUES($1,$2,clock_timestamp()-interval '1 day',NULL)", [apoderadoFamilia, randomUUID()]);
    await pool.query("INSERT INTO credencial(cuenta_id,tipo,token_hash,emitida_en) VALUES($1,'familia',$2,now()-interval '400 days')", [familiar, hashToken(enlaceFamilia)]);
    expect((await entrar(enlaceFamilia, "familia")).contexto.cuentaId).toBe(familiar);
    await pool.query("UPDATE credencial SET estado='terminada' WHERE cuenta_id=$1", [familiar]);
    await expect(entrar(enlaceFamilia, "familia")).rejects.toMatchObject({ codigo: "acceso_denegado" });
  } finally {
    for (const [clave, valor] of [["JWT_CLAVE", anterior.jwt], ["JWT_KID", anterior.kid], ["JWT_CLAVES", anterior.claves], ["RENOVACION_CLAVE", anterior.renovacion]] as const) { if (valor === undefined) delete process.env[clave]; else process.env[clave] = valor; }
  }
}, 15000);
test("RF-102: dos desactivaciones concurrentes no eliminan el último ADM", async () => {
  // La transacción de beforeEach no toma bloqueos; ambos contendientes usan conexiones independientes.
  const desactivar = async (cuentaId: string) => {
    const conexion = await pool.connect();
    try {
      await conexion.query(`SET search_path TO ${esquema},pg_catalog; BEGIN`);
      await conexion.query("UPDATE cuenta SET activa=false WHERE id=$1", [cuentaId]);
      await conexion.query("COMMIT");
      return "permitido";
    } catch (error) {
      await conexion.query("ROLLBACK");
      if (error && typeof error === "object" && "code" in error && error.code === "23514") return "denegado";
      throw error;
    } finally { conexion.release(); }
  };
  expect((await Promise.all([desactivar(administrador), desactivar(segundoAdministrador)])).sort()).toEqual(["denegado", "permitido"]);
  expect(Number((await cliente.query("SELECT count(*) FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id WHERE c.activa AND r.rol='administracion'")).rows[0].count)).toBe(1);
});
