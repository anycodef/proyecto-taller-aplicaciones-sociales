import { randomUUID, randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { HttpRequest, InvocationContext } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { idSesion } from "@/lib/asistencia/sesiones";
import { abrirCiclo, cerrarCiclo } from "../../../src/modulos/ciclos/aplicacion/gestionar-ciclo";
import { enTransaccion } from "../../../src/compartido/bd/transaccion";
import { push } from "../../../src/modulos/sincronizacion/aplicacion/push";
import { pull } from "../../../src/modulos/sincronizacion/aplicacion/pull";
import { registrarProveedor } from "../../../src/modulos/sincronizacion/aplicacion/registro-proveedores";
import { proveedorActividades } from "../../../src/modulos/actividades/infraestructura/proveedor-sincronizacion";
import { proveedorCiclos } from "../../../src/modulos/ciclos/infraestructura/proveedor-sincronizacion";
import { manejadoresCiclos } from "../../../src/modulos/ciclos/http";
import { manejadoresActividades } from "../../../src/modulos/actividades/http";
import { firmarJwt } from "../../../src/modulos/seguridad/infraestructura/firmador-jwt";
import type { EntradaActividad } from "../../../src/modulos/actividades/dominio/validacion";
import { consultarCumplimiento } from "../../../src/modulos/actividades/aplicacion/consultar-cumplimiento";
const esquema = `transversal_${randomUUID().replaceAll("-", "")}`;
let pool: Pool, admin: Pool, adm: ContextoAcceso, coord: ContextoAcceso, cat: ContextoAcceso, fam: ContextoAcceso;
let cicloId: string;
const claveAnterior = process.env.JWT_CLAVE;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (sql: string, valores: unknown[]) => pool.query(sql, valores) }));
async function cuenta(rol: Rol): Promise<ContextoAcceso> {
  const cuentaId = randomUUID(), credencialId = randomUUID(), dispositivoId = rol === "familia" ? undefined : randomUUID();
  await admin.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,$2,false)", [cuentaId, cuentaId]);
  await admin.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,$2)", [cuentaId, rol]);
  await admin.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado,dispositivo_id) VALUES($1,$2,$3,$4,'activa',$5)", [credencialId, cuentaId, rol === "familia" ? "familia" : "equipo", randomBytes(32), dispositivoId ?? null]);
  return { cuentaId, credencialId, dispositivoId, rolesPropios: [rol], identidadOperativa: cuentaId, esMenor: false, gruposAsignados: [], catequizandosApoderados: [] };
}
const datosCiclo = (id = cicloId) => ({ id, nombre: "Ciclo transversal", fechaInicio: "2020-03-01", fechaFin: "2020-12-31" });
const actividad = (cambios: Partial<EntradaActividad> = {}): EntradaActividad => ({ id: randomUUID(), ciclo_id: cicloId, nombre: "Jornada", tipo: "jornada", fecha: "2020-10-04", estado: "vigente", creado_por: coord.cuentaId, cuenta_id: coord.cuentaId, credencial_id: coord.credencialId, dispositivo_id: coord.dispositivoId!, ...cambios });
const lote = (fila: EntradaActividad, actualizar = false) => ({ changes: { actividades_obligatorias: { created: actualizar ? [] : [fila], updated: actualizar ? [fila] : [], deleted: [] } } });
async function crearNino(grupoId: string, cuentaFamilia?: string): Promise<string> {
  const id = randomUUID(), apoderado = randomUUID(), consentimiento = randomUUID(), inscripcion = randomUUID();
  await admin.query("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,'Niña','Prueba','2010-01-01','femenino',true,$2)", [id, coord.cuentaId]);
  await admin.query("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto,cuenta_id) VALUES($1,'Adulto','Prueba','otro','prueba',$2)", [apoderado, cuentaFamilia ?? null]);
  await admin.query("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'tutor')", [randomUUID(), id, apoderado]);
  await admin.query("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, id, apoderado, coord.cuentaId]);
  await admin.query("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,10,false,'prueba','2020-03-01T05:00:00Z')", [inscripcion, id, cicloId, consentimiento]);
  await admin.query("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,'2020-03-01T05:00:00Z')", [randomUUID(), inscripcion, grupoId, coord.cuentaId]);
  return id;
}
async function crearGrupo(): Promise<string> {
  const id = randomUUID();
  await admin.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,$3,8,13,'mixto')", [id, cicloId, id]);
  return id;
}
async function peticion(ctx: ContextoAcceso, method: string, url: string, body?: unknown, params: Record<string, string> = {}) {
  const jwt = await firmarJwt({ cuentaId: ctx.cuentaId, credencialId: ctx.credencialId, tipo: ctx.rolesPropios.includes("familia") ? "familia" : "equipo", dispositivoId: ctx.dispositivoId });
  return new HttpRequest({ method, url: `http://localhost/api/${url}`, params, headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" }, ...(body ? { body: { string: JSON.stringify(body) } } : {}) });
}
beforeAll(async () => {
  if (!process.env.BD_PRUEBAS_URL) throw new Error("Falta BD_PRUEBAS_URL");
  process.env.JWT_CLAVE = "clave-transversal-solo-pruebas-sin-uso-en-produccion";
  admin = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 3, options: `-c search_path=${esquema},pg_catalog -c timezone=America/Lima` });
  await admin.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion`);
  const directorio = resolve(__dirname, "../../../migraciones");
  const conexion = await admin.connect();
  try {
    for (const archivo of (await readdir(directorio)).filter(archivo => /^\d{4}_.*\.sql$/.test(archivo) && !archivo.startsWith("0001_")).sort()) {
      await conexion.query((await readFile(resolve(directorio, archivo), "utf8")).replace(/\bpublic\b/g, esquema));
    }
  } finally { conexion.release(); }
  pool = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 3, options: `-c search_path=${esquema},pg_catalog -c role=sigecat_api -c timezone=America/Lima -c statement_timeout=15000` });
  adm = await cuenta("administracion"); coord = await cuenta("coordinacion"); cat = await cuenta("catequista"); fam = await cuenta("familia");
  await admin.query("INSERT INTO identidad_real(cuenta_id,nombres,apellidos,fecha_nacimiento) VALUES($1,'Nunca','Exportar','2008-03-02')", [cat.cuentaId]);
  registrarProveedor(proveedorCiclos); registrarProveedor(proveedorActividades);
}, 60000);
beforeEach(async () => {
  await admin.query("UPDATE ciclo SET estado='cerrado',cerrado_en=now() WHERE estado='abierto'");
  cicloId = randomUUID();
  await enTransaccion(tx => abrirCiclo(datosCiclo(), adm, tx));
});
afterAll(async () => {
  if (claveAnterior === undefined) delete process.env.JWT_CLAVE; else process.env.JWT_CLAVE = claveAnterior;
  if (pool) await pool.end();
  if (admin) { try { await admin.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await admin.end(); } }
});
test("RF-801: apertura genera domingos una sola vez, recalcula minoría y restablece rol API", async () => {
  const inicial = (await pool.query("SELECT count(*)::int n FROM sesion WHERE ciclo_id=$1", [cicloId])).rows[0].n;
  expect(inicial).toBeGreaterThan(80);
  expect(await enTransaccion(tx => abrirCiclo(datosCiclo(), adm, tx))).toMatchObject({ creado: false });
  expect((await pool.query("SELECT count(*)::int n FROM sesion WHERE ciclo_id=$1", [cicloId])).rows[0].n).toBe(inicial);
  expect((await pool.query("SELECT es_menor FROM cuenta WHERE id=$1", [cat.cuentaId])).rows[0].es_menor).toBe(true);
  expect((await pool.query("SELECT current_user rol")).rows[0].rol).toBe("sigecat_api");
  await expect(enTransaccion(tx => abrirCiclo(datosCiclo(randomUUID()), adm, tx))).rejects.toMatchObject({ codigo: "ciclo_abierto_existente" });
  await expect(enTransaccion(tx => abrirCiclo(datosCiclo(randomUUID()), coord, tx))).rejects.toMatchObject({ estado: 403 });
});
test("RF-504 RNF-503: push crea catálogo y sesión determinista, reintento y pull nativos", async () => {
  const fila = actividad();
  expect(await push(lote(fila), coord)).toEqual({ aceptados: 1, rechazados: 0, descartadosCierre: 0 });
  expect(await push(lote(fila), coord)).toMatchObject({ aceptados: 1 });
  const sesion = (await pool.query("SELECT id FROM sesion WHERE actividad_id=$1", [fila.id])).rows[0];
  expect(sesion.id).toBe(idSesion(cicloId, fila.fecha, "actividad", fila.id));
  const bajada = await pull({ ultimoPulso: null, versionEsquema: 1 }, coord);
  expect(bajada.changes.actividades_obligatorias.created).toContainEqual(fila);
  expect(bajada.changes.ciclos.created).toMatchObject([{ id: cicloId, fecha_inicio: "2020-03-01" }]);
  expect(bajada.timestamp).toEqual(expect.any(Number));
});
test("RF-504: rechazos de autoría y colisión son durables, no bloquean el siguiente push", async () => {
  const fila = actividad(); await push(lote(fila), coord);
  expect(await push(lote({ ...fila, nombre: "Colisión" }), coord)).toMatchObject({ rechazados: 1 });
  const invalida = actividad({ creado_por: cat.cuentaId, cuenta_id: cat.cuentaId, credencial_id: cat.credencialId, dispositivo_id: cat.dispositivoId! });
  expect(await push(lote(invalida), cat)).toMatchObject({ rechazados: 1 });
  await push(lote(invalida), cat);
  expect((await pool.query("SELECT count(*)::int n FROM aviso_asistencia WHERE ciclo_id=$1 AND tipo='rechazo_actividad'", [cicloId])).rows[0].n).toBe(2);
  expect(await push(lote(actividad()), coord)).toMatchObject({ aceptados: 1 });
});
test("RF-504: reprogramación conserva sesión previa cancelada y cancelación no suma asistencia", async () => {
  const fila = actividad(); await push(lote(fila), coord);
  const movida = { ...fila, fecha: "2020-10-11", tipo: "retiro" as const };
  expect(await push(lote(movida, true), coord)).toMatchObject({ aceptados: 1 });
  expect((await pool.query("SELECT cancelada FROM sesion WHERE id=$1", [idSesion(cicloId, fila.fecha, "actividad", fila.id)])).rows[0].cancelada).toBe(true);
  await push(lote({ ...movida, estado: "cancelada" }, true), coord);
  expect((await pool.query("SELECT bool_and(cancelada) canceladas FROM sesion WHERE actividad_id=$1", [fila.id])).rows[0].canceladas).toBe(true);
  expect((await pool.query("SELECT count(*)::int n FROM cambio_actividad WHERE actividad_id=$1", [fila.id])).rows[0].n).toBe(3);
  await expect(pool.query("UPDATE cambio_actividad SET valor_nuevo='otro' WHERE actividad_id=$1", [fila.id])).rejects.toMatchObject({ code: "42501" });
  await expect(admin.query("UPDATE cambio_actividad SET valor_nuevo='otro' WHERE actividad_id=$1", [fila.id])).rejects.toMatchObject({ code: "SG504" });
});
test("RF-802 RF-803: cierre atómico revoca familias, termina delegación y push tardío se descarta", async () => {
  const aplicada = actividad(); await push(lote(aplicada), coord);
  const familia = await cuenta("familia");
  const delegacionId = randomUUID();
  await admin.query("INSERT INTO delegacion(id,delegante_id,delegado_id,desde,hasta) VALUES($1,$2,$3,now()-interval '1 day',now()+interval '1 day')", [delegacionId, coord.cuentaId, cat.cuentaId]);
  const cierre = await enTransaccion(tx => cerrarCiclo(cicloId, adm, tx));
  expect(cierre.efectos.delegacionesTerminadas).toBe(1);
  expect(cierre.efectos.enlacesRevocados).toBeGreaterThan(0);
  expect(await enTransaccion(tx => cerrarCiclo(cicloId, adm, tx))).toEqual(cierre);
  expect((await pool.query("SELECT estado,motivo_fin FROM credencial WHERE id=$1", [familia.credencialId])).rows[0]).toMatchObject({ estado: "terminada", motivo_fin: "cierre_ciclo" });
  expect((await pool.query("SELECT activa FROM cuenta WHERE id=$1", [cat.cuentaId])).rows[0].activa).toBe(true);
  expect(await push(lote(actividad()), coord)).toMatchObject({ aceptados: 0, descartadosCierre: 1 });
  expect(await push(lote(aplicada), coord)).toMatchObject({ aceptados: 1, descartadosCierre: 0 });
  expect(await push(lote({ ...aplicada, nombre: "Cambio tardío" }, true), coord)).toMatchObject({ aceptados: 0, descartadosCierre: 1 });
  const bajada = await pull({ ultimoPulso: Date.now()-1000, versionEsquema: 1, huellaAlcance: "anterior" }, coord);
  expect(bajada.experimentalStrategy).toBe("replacement"); expect(bajada.changes.ciclos.created).toEqual([]);
  await expect(pool.query("UPDATE ciclo SET estado='abierto' WHERE id=$1", [cicloId])).rejects.toMatchObject({ code: "SG801" });
});
test("RF-801 RF-504: HTTP autenticado lectura, apertura solo ADM y catálogo de equipo", async () => {
  const inv = new InvocationContext();
  expect((await manejadoresCiclos.abierto(await peticion(coord, "GET", "ciclos/abierto"), inv)).status).toBe(200);
  expect((await manejadoresCiclos.abrir(await peticion(coord, "POST", "ciclos", datosCiclo(randomUUID())), inv)).status).toBe(403);
  expect((await manejadoresActividades.listar(await peticion(cat, "GET", "actividades"), inv)).status).toBe(200);
  // La credencial de familia de pruebas se emite de nuevo para este caso independiente.
  fam = await cuenta("familia");
  await crearNino(await crearGrupo(), fam.cuentaId);
  expect((await manejadoresCiclos.abierto(await peticion(fam, "GET", "ciclos/abierto"), inv)).status).toBe(200);
  expect((await manejadoresActividades.listar(await peticion(fam, "GET", "actividades"), inv)).status).toBe(403);
  const alta = { id: randomUUID(), cicloId, nombre: "Retiro HTTP", tipo: "retiro", fecha: "2020-11-01" };
  expect((await manejadoresActividades.crear(await peticion(coord, "POST", "actividades", alta), inv)).status).toBe(201);
  expect((await manejadoresActividades.crear(await peticion(coord, "POST", "actividades", alta), inv)).status).toBe(200);
  expect((await manejadoresActividades.crear(await peticion(cat, "POST", "actividades", { ...alta, id: randomUUID() }), inv)).status).toBe(403);
  expect((await manejadoresActividades.actualizar(await peticion(coord, "PATCH", `actividades/${alta.id}`, { estado: "cancelada" }, { id: alta.id }), inv)).status).toBe(200);
  expect((await pool.query("SELECT cancelada FROM sesion WHERE actividad_id=$1", [alta.id])).rows[0].cancelada).toBe(true);
});
test("RF-504 RNF-503 RF-313: cumplimiento reutiliza asistencia, limita alcance y bloquea reprogramación", async () => {
  const grupo = await crearGrupo(), ajeno = await crearGrupo();
  const propio = await crearNino(grupo), otro = await crearNino(ajeno);
  const fila = actividad(); await push(lote(fila), coord);
  const sesionId = idSesion(cicloId, fila.fecha, "actividad", fila.id);
  await admin.query("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id,desde) VALUES($1,$2,$3,'2020-03-01T05:00:00Z')", [randomUUID(), grupo, cat.cuentaId]);
  const marca = (nino: string) => ({ id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, valor: "presente", tipo_registro: "manual", registrado_por: cat.cuentaId, hora_dispositivo: Date.parse('2020-10-04T10:00:00-05:00'), desfase_reloj_ms: 0, cuenta_id: cat.cuentaId, credencial_id: cat.credencialId, dispositivo_id: cat.dispositivoId });
  expect(await push({ changes: { marcas_asistencia: { created: [marca(propio), marca(otro)], updated: [], deleted: [] } } }, cat)).toMatchObject({ aceptados: 1, rechazados: 1 });
  const visible = await enTransaccion(tx => consultarCumplimiento(fila.id, { ...cat, gruposAsignados: [grupo] }, tx));
  expect(visible).toEqual([{ catequizandoId: propio, sesionId, estado: "cumplida", registradores: [cat.identidadOperativa] }]);
  expect(await push(lote({ ...fila, fecha: '2020-10-11' }, true), coord)).toMatchObject({ rechazados: 1 });
  expect((await pool.query("SELECT fecha::text FROM actividad_obligatoria WHERE id=$1", [fila.id])).rows[0].fecha).toBe(fila.fecha);
  await push(lote({ ...fila, estado: 'cancelada' }, true), coord);
  expect((await enTransaccion(tx => consultarCumplimiento(fila.id, { ...cat, gruposAsignados: [grupo] }, tx)))[0].estado).toBe("cancelada");
});
test("RF-802: fallo de revocación revierte cierre y delegaciones en la misma transacción", async () => {
  const familia = await cuenta("familia"), delegacionId = randomUUID();
  await admin.query("INSERT INTO delegacion(id,delegante_id,delegado_id,desde,hasta) VALUES($1,$2,$3,now()-interval '1 day',now()+interval '1 day')", [delegacionId, coord.cuentaId, cat.cuentaId]);
  await admin.query(`CREATE FUNCTION fallar_revocacion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo_de_prueba'; END $$;
    CREATE TRIGGER fallar_revocacion BEFORE UPDATE ON credencial FOR EACH ROW WHEN (OLD.tipo='familia') EXECUTE FUNCTION fallar_revocacion()`);
  try {
    await expect(enTransaccion(tx => cerrarCiclo(cicloId, adm, tx))).rejects.toThrow("fallo_de_prueba");
    expect((await pool.query("SELECT estado FROM ciclo WHERE id=$1", [cicloId])).rows[0].estado).toBe("abierto");
    expect((await pool.query("SELECT revocada_en FROM delegacion WHERE id=$1", [delegacionId])).rows[0].revocada_en).toBeNull();
    expect((await pool.query("SELECT estado FROM credencial WHERE id=$1", [familia.credencialId])).rows[0].estado).toBe("activa");
  } finally { await admin.query("DROP TRIGGER fallar_revocacion ON credencial; DROP FUNCTION fallar_revocacion()"); }
});
