import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { HttpRequest, InvocationContext } from "@azure/functions";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { idSesion } from "@/lib/asistencia/sesiones";
import { aplicarPush, push } from "../../../src/modulos/sincronizacion/aplicacion/push";
import { pull } from "../../../src/modulos/sincronizacion/aplicacion/pull";
import { consultarResumenAsistencia } from "../../../src/modulos/asistencia/aplicacion/consultar-faltas";
import { reporteMisa } from "../../../src/modulos/asistencia/aplicacion/reporte-misa";
import { participanteRetencionAsistencia } from "../../../src/modulos/asistencia/aplicacion/retencion";
import { registrarAlCambiarAsistencia, registrarFuenteJustificaciones, fuenteJustificacionesVacia } from "../../../src/modulos/asistencia/dominio/puertos";
import type { EntradaCorreccion, EntradaMarca } from "../../../src/modulos/sincronizacion/dominio/validacion";
import { firmarJwt } from "../../../src/modulos/seguridad/infraestructura/firmador-jwt";
import { manejadoresAsistencia } from "../../../src/modulos/asistencia/http";
import { leerCuerpoAcotado, manejadoresSincronizacion } from "../../../src/modulos/sincronizacion/http";
import { gunzipSync } from "node:zlib";
import { procesarEscaneo } from "@/lib/asistencia/escaneo";
import { abrirLista, alternar, confirmarLista } from "@/lib/asistencia/lista";
import { correccionAFila, listaAFila, marcaAFila } from "@/lib/asistencia/serializacion";
import type { NinoNomina } from "@/lib/asistencia/tipos";
import { crearSesionActividad } from "../../../src/modulos/asistencia/aplicacion/generar-sesiones";
import { consultarCumplimientoActividad } from "../../../src/modulos/asistencia/aplicacion/cumplimiento-actividad";
import { anonimizarCatequizando } from "../../../src/modulos/catequizandos/aplicacion/retencion";
import { enTransaccion } from "../../../src/compartido/bd/transaccion";
import type { RespuestaPull, ResumenPush } from "@/lib/sincronizacion/protocolo";
import { depurarLapidasSincronizacion } from "../../../src/modulos/asistencia/infraestructura/lapidas-sincronizacion";

const esquema = `asistencia_${randomUUID().replaceAll("-", "")}`;
let pool: Pool;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (texto: string, valores: unknown[]) => pool.query(texto, valores) }));
const cicloId = randomUUID(), grupoId = randomUUID(), grupoAjeno = randomUUID();
const fecha = "2020-10-04", sesionId = idSesion(cicloId, fecha, "misa"), catequesisId = idSesion(cicloId, fecha, "catequesis");
let cuenta: ContextoAcceso, otraCuenta: ContextoAcceso;
const claveAnterior = process.env.JWT_CLAVE;
async function crearCuenta(indice: string): Promise<ContextoAcceso> {
  const cuentaId = randomUUID(), credencialId = randomUUID(), dispositivoId = randomUUID();
  await pool.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,$2,true)", [cuentaId, `Luz ${indice}`]);
  await pool.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'catequista'),($1,'coordinacion')", [cuentaId]);
  await pool.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado,dispositivo_id) VALUES($1,$2,'equipo',$3,'activa',$4)", [credencialId, cuentaId, randomBytes(32), dispositivoId]);
  return { cuentaId, credencialId, dispositivoId, identidadOperativa: `Luz ${indice}`, esMenor: true, rolesPropios: ["catequista", "coordinacion"], gruposAsignados: [grupoId], catequizandosApoderados: [] };
}
async function crearNino(grupo = grupoId, desde = "2020-01-01T05:00:00Z"): Promise<string> {
  const id = randomUUID(), apoderado = randomUUID(), consentimiento = randomUUID(), inscripcion = randomUUID();
  await pool.query("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,'Ana','Prueba','2010-01-01','femenino',true,$2)", [id, cuenta.cuentaId]);
  await pool.query("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto) VALUES($1,'Adulto','Prueba','otro','prueba')", [apoderado]);
  await pool.query("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, id, apoderado, cuenta.cuentaId]);
  await pool.query("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,10,false,'prueba',$5)", [inscripcion, id, cicloId, consentimiento, desde]);
  await pool.query("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,$5)", [randomUUID(), inscripcion, grupo, cuenta.cuentaId, desde]);
  await pool.query("INSERT INTO carne_emision(catequizando_id,emision,emitida_por) VALUES($1,1,$2)", [id, cuenta.cuentaId]);
  return id;
}
function nuevaMarca(nino: string | null, autor = cuenta, cambios: Partial<EntradaMarca> = {}): EntradaMarca {
  return { id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, codigo_leido: nino ? `SGC1:${nino}:1` : "ilegible",
    valor: "presente", tipo_registro: "escaneo", registrado_por: autor.cuentaId, cuenta_id: autor.cuentaId, credencial_id: autor.credencialId, dispositivo_id: autor.dispositivoId!, hora_dispositivo: Date.parse(`${fecha}T08:00:00-05:00`), desfase_reloj_ms: 0, ...cambios };
}
const lote = (marcas: EntradaMarca[]) => ({ changes: { marcas_asistencia: { created: marcas, updated: [], deleted: [] } } });
test("RF-307 RNF-306: metadatos WatermelonDB se ignoran, reenvío no duplica y pull no devuelve estado local", async () => {
  const nino = await crearNino();
  const marca = nuevaMarca(nino);
  const entrada = { changes: { marcas_asistencia: { created: [{ ...marca, _status: "created", _changed: "valor,codigo_leido", estado: "rechazada", motivo_rechazo: "feedback antiguo", recibido_en: 1 }], updated: [], deleted: [] } } };
  expect(await push(entrada, cuenta)).toMatchObject({ aceptados: 1, rechazados: 0 });
  entrada.changes.marcas_asistencia.created[0]._status = "updated";
  entrada.changes.marcas_asistencia.created[0]._changed = "";
  entrada.changes.marcas_asistencia.created[0].estado = "aceptada";
  entrada.changes.marcas_asistencia.created[0].recibido_en = Date.now();
  expect(await push(entrada, cuenta)).toMatchObject({ aceptados: 1, rechazados: 0 });
  const guardada = (await pool.query<{ fila: Record<string, unknown> }>("SELECT to_jsonb(m) AS fila FROM marca_asistencia m WHERE id=$1", [marca.id])).rows[0].fila;
  expect(guardada).not.toHaveProperty("_status");
  expect(guardada).not.toHaveProperty("_changed");
  expect(guardada.estado).toBe("aceptada");
  expect(guardada.motivo_rechazo).toBeNull();
  expect(Date.parse(String(guardada.recibido_en))).toBeGreaterThan(1);
  const descargada = await pull({ ultimoPulso: null, versionEsquema: 1 }, cuenta);
  const fila = descargada.changes.marcas_asistencia.created.find(fila => fila.id === marca.id);
  expect(fila).toBeDefined();
  expect(fila).not.toHaveProperty("_status");
  expect(fila).not.toHaveProperty("_changed");
  const invalida = { ...nuevaMarca(null), estado: "aceptada", recibido_en: 1, motivo_rechazo: null, _status: "created", _changed: "codigo_leido" };
  expect(await push({ changes: { marcas_asistencia: { created: [invalida], updated: [], deleted: [] } } }, cuenta)).toMatchObject({ aceptados: 0, rechazados: 1 });
  expect((await pool.query("SELECT estado FROM marca_asistencia WHERE id=$1", [invalida.id])).rows[0].estado).toBe("rechazada");
  await expect(push({ changes: { marcas_asistencia: { created: [{ ...marca, campoAjeno: "no permitido" }], updated: [], deleted: [] } } }, cuenta)).rejects.toMatchObject({ estado: 422 });
});
async function retirarEnTransaccion(nino: string): Promise<void> {
  await enTransaccion(async tx => {
    await tx.query("SET LOCAL ROLE sigecat_retencion");
    await tx.query("SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
    await anonimizarCatequizando(nino, tx);
    await participanteRetencionAsistencia.alRetirarConsentimiento(nino, tx);
  });
}
function aplicarAlCliente(cliente: Map<string, Set<string>>, respuesta: RespuestaPull): void {
  for (const [tabla, cambios] of Object.entries(respuesta.changes)) {
    const ids = respuesta.experimentalStrategy === "replacement" ? new Set<string>() : cliente.get(tabla) ?? new Set<string>();
    for (const fila of [...cambios.created, ...cambios.updated]) ids.add(fila.id);
    for (const id of cambios.deleted) ids.delete(id);
    cliente.set(tabla, ids);
  }
}
async function esperarBloqueo(esperando: number, reteniendo: number): Promise<void> {
  const limite = Date.now() + 3000;
  while (Date.now() < limite) {
    const bloqueo = await pool.query<{ bloqueado: boolean }>("SELECT $2::integer=ANY(pg_blocking_pids($1::integer)) AS bloqueado", [esperando, reteniendo]);
    if (bloqueo.rows[0].bloqueado) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("La transacción no quedó bloqueada por la fila del niño");
}
beforeAll(async () => {
  const url = process.env.BD_PRUEBAS_URL;
  if (!url) throw new Error("Falta BD_PRUEBAS_URL: levantar PostgreSQL de api/docker-compose.yml; integración 003 no se omite");
  process.env.JWT_CLAVE = "clave-de-prueba-003-sin-uso-en-produccion";
  pool = new Pool({ connectionString: url, max: 3, options: `-c search_path=${esquema},pg_catalog -c timezone=America/Lima -c statement_timeout=15000` });
  const conexion = await pool.connect();
  try {
    await conexion.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion; SET search_path TO ${esquema},pg_catalog`);
    const directorio = resolve(__dirname, "../../../migraciones");
    const archivos = (await readdir(directorio)).filter(archivo => /^(000[2-9]|01\d\d|02\d\d|03\d\d|0505|0801)_.*\.sql$/.test(archivo)).sort();
    if (!archivos.some(archivo => archivo.startsWith("0002_")) || !archivos.some(archivo => archivo.startsWith("0505_"))) throw new Error("Faltan migraciones transversales 0002/0505 de integración");
    for (const archivo of archivos) await conexion.query((await readFile(resolve(directorio, archivo), "utf8")).replace(/\bpublic\b/g, esquema));
  } finally { conexion.release(); }
  cuenta = await crearCuenta("principal"); otraCuenta = await crearCuenta("suplente");
  await pool.query("INSERT INTO ciclo(id,nombre,inicio,fin,estado,abierto_por) VALUES($1,'Ciclo de prueba 003','2020-01-01','2020-12-31','abierto',$2)", [cicloId, cuenta.cuentaId]);
  await pool.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$3,'Propio',8,13,'mixto'),($2,$3,'Ajeno',8,13,'mixto')", [grupoId, grupoAjeno, cicloId]);
  await pool.query("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id,desde) VALUES($1,$2,$3,'2020-01-01T05:00:00Z')", [randomUUID(), grupoId, cuenta.cuentaId]);
  await pool.query("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$3,$4,'misa'),($2,$3,$4,'catequesis')", [sesionId, catequesisId, cicloId, fecha]);
}, 60000);
afterEach(() => { registrarFuenteJustificaciones(fuenteJustificacionesVacia); registrarAlCambiarAsistencia(async () => {}); });
afterAll(async () => {
  if (claveAnterior === undefined) delete process.env.JWT_CLAVE; else process.env.JWT_CLAVE = claveAnterior;
  if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await pool.end(); } }
});

test("RF-307 RF-308: UUID idempotente conserva un consolidado, ambos autores y recibido del primer insert", async () => {
  const nino = await crearNino(), marca = nuevaMarca(nino);
  expect(await push(lote([marca]), cuenta)).toEqual({ aceptados: 1, rechazados: 0, descartadosCierre: 0 });
  const primero = (await pool.query("SELECT recibido_en FROM marca_asistencia WHERE id=$1", [marca.id])).rows[0].recibido_en;
  await push(lote([marca]), cuenta);
  await push(lote([nuevaMarca(nino, otraCuenta)]), otraCuenta);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM asistencia WHERE sesion_id=$1 AND catequizando_id=$2", [sesionId, nino])).rows[0].cantidad).toBe(1);
  expect((await pool.query("SELECT count(DISTINCT registrado_por)::int AS cantidad FROM marca_asistencia WHERE sesion_id=$1 AND catequizando_id=$2", [sesionId, nino])).rows[0].cantidad).toBe(2);
  expect((await pool.query("SELECT recibido_en FROM marca_asistencia WHERE id=$1", [marca.id])).rows[0].recibido_en).toEqual(primero);
  expect(await push(lote([marca]), otraCuenta)).toMatchObject({ aceptados: 0, rechazados: 1 });
});
test("RF-303: inválido/reemitido offline se persiste rechazado con aviso sin asistencia", async () => {
  const nino = await crearNino(), marca = nuevaMarca(nino);
  await pool.query("UPDATE carne_emision SET invalidada_en=clock_timestamp() WHERE catequizando_id=$1", [nino]);
  await pool.query("INSERT INTO carne_emision(catequizando_id,emision,emitida_por) VALUES($1,2,$2)", [nino, cuenta.cuentaId]);
  const ilegible = nuevaMarca(null);
  expect(await push(lote([marca, ilegible]), cuenta)).toMatchObject({ rechazados: 2, aceptados: 0 });
  await push(lote([marca, ilegible]), cuenta);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM aviso_asistencia WHERE marca_id=ANY($1::uuid[])", [[marca.id, ilegible.id]])).rows[0].cantidad).toBe(2);
  expect((await pool.query("SELECT estado FROM marca_asistencia WHERE id=$1", [marca.id])).rows[0].estado).toBe("rechazada");
  expect((await pool.query("SELECT id FROM asistencia WHERE catequizando_id=$1", [nino])).rowCount).toBe(0);
});
test("RF-304 RF-305: manual ajeno y niño inscrito después de la fecha son rechazos de negocio", async () => {
  const ajeno = await crearNino(grupoAjeno), posterior = await crearNino(grupoId, "2020-10-05T05:00:00Z");
  expect(await push(lote([nuevaMarca(ajeno, cuenta, { tipo_registro: "manual", codigo_leido: null }), nuevaMarca(posterior)]), cuenta)).toMatchObject({ rechazados: 2 });
});
test("RF-307: autor/credencial falsificados no escriben pendientes en nombre ajeno y readonly falla 422", async () => {
  const nino = await crearNino(), falsificada = nuevaMarca(nino, otraCuenta);
  expect(await push(lote([falsificada]), cuenta)).toMatchObject({ rechazados: 1 });
  const fila = (await pool.query("SELECT estado,cuenta_id,registrado_por FROM marca_asistencia WHERE id=$1", [falsificada.id])).rows[0];
  expect(fila).toMatchObject({ estado: "rechazada", cuenta_id: cuenta.cuentaId, registrado_por: cuenta.cuentaId });
  await expect(push({ changes: { asistencias: { created: [], updated: [], deleted: [] } } }, cuenta)).rejects.toMatchObject({ estado: 422 });
});
test("RF-306 RF-308 RF-310: suplente confirma otro grupo completo, presente gana y aviso cruzado es único", async () => {
  const nino = await crearNino(grupoAjeno);
  const miembros = (await pool.query("SELECT n.id FROM catequizando n JOIN inscripcion i ON i.catequizando_id=n.id JOIN asignacion_grupo a ON a.inscripcion_id=i.id WHERE a.grupo_id=$1 AND i.desde<'2020-10-05T05:00:00Z' AND i.hasta IS NULL", [grupoAjeno])).rows as { id: string }[];
  const listaId = randomUUID(), hora = Date.parse(`${fecha}T10:00:00-05:00`);
  const lista = { id: listaId, ciclo_id: cicloId, sesion_id: catequesisId, grupo_id: grupoAjeno, confirmada_por: cuenta.cuentaId, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId, abierta_en: hora - 60000, confirmada_en: hora, desfase_reloj_ms: 0, total_presentes: 0, total_ausentes: miembros.length };
  const marcas = miembros.map(miembro => nuevaMarca(miembro.id, cuenta, { sesion_id: catequesisId, codigo_leido: null, tipo_registro: "lista", lista_id: listaId, valor: "ausente", hora_dispositivo: hora }));
  const entrada = { changes: { listas_asistencia: { created: [lista], updated: [], deleted: [] }, marcas_asistencia: { created: marcas, updated: [], deleted: [] } } };
  const incompleta = { changes: { listas_asistencia: { created: [{ ...lista, id: randomUUID() }], updated: [], deleted: [] } } };
  expect(await push(incompleta, cuenta)).toMatchObject({ rechazados: 1 });
  expect((await push(entrada, cuenta)).rechazados).toBe(0);
  await push(lote([nuevaMarca(nino)]), cuenta);
  await push(entrada, cuenta);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM aviso_asistencia WHERE catequizando_id=$1 AND tipo='revision_cruzada'", [nino])).rows[0].cantidad).toBe(1);
  const otraListaId = randomUUID();
  const otraLista = { ...lista, id: otraListaId, confirmada_por: otraCuenta.cuentaId, cuenta_id: otraCuenta.cuentaId, credencial_id: otraCuenta.credencialId, dispositivo_id: otraCuenta.dispositivoId, total_presentes: miembros.length, total_ausentes: 0 };
  const presentes = miembros.map(miembro => nuevaMarca(miembro.id, otraCuenta, { sesion_id: catequesisId, codigo_leido: null, tipo_registro: "lista", lista_id: otraListaId, hora_dispositivo: hora }));
  expect((await push({ changes: { listas_asistencia: { created: [otraLista], updated: [], deleted: [] }, marcas_asistencia: { created: presentes, updated: [], deleted: [] } } }, otraCuenta)).rechazados).toBe(0);
  expect((await pool.query("SELECT valor,conflicto FROM asistencia WHERE sesion_id=$1 AND catequizando_id=$2", [catequesisId, nino])).rows[0]).toMatchObject({ valor: "presente", conflicto: true });
});
test("RF-309: corrección conserva historia, emite evento y puerto transaccional falla con rollback total", async () => {
  const nino = await crearNino();
  await push(lote([nuevaMarca(nino)]), cuenta);
  const correccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, valor_anterior: "presente", valor_nuevo: "ausente", corregido_por: cuenta.cuentaId, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId, hora_dispositivo: Date.parse(`${fecha}T11:00:00-05:00`), desfase_reloj_ms: 0 };
  const entrada = { changes: { correcciones_asistencia: { created: [correccion], updated: [], deleted: [] } } };
  registrarAlCambiarAsistencia(async () => { throw new Error("Puerto no disponible"); });
  await expect(push(entrada, cuenta)).rejects.toThrow("Puerto no disponible");
  expect((await pool.query("SELECT id FROM correccion_asistencia WHERE id=$1", [correccion.id])).rowCount).toBe(0);
  registrarAlCambiarAsistencia(async () => {});
  expect((await push(entrada, cuenta)).aceptados).toBe(1);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM evento_asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(2);
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN; SET LOCAL ROLE sigecat_api");
    await expect(cliente.query("UPDATE marca_asistencia SET valor='ausente' WHERE catequizando_id=$1", [nino])).rejects.toMatchObject({ code: "42501" });
    await cliente.query("ROLLBACK; BEGIN; SET LOCAL ROLE sigecat_retencion");
    await expect(cliente.query("UPDATE correccion_asistencia SET motivo=NULL WHERE id=$1", [correccion.id])).rejects.toMatchObject({ code: "42501" });
  } finally { await cliente.query("ROLLBACK; RESET ROLE"); cliente.release(); }
});
test("RF-307 RNF-306: pull native minimal, rechazados propios y reemplazo ante pérdida de alcance", async () => {
  const nino = await crearNino();
  const marca = nuevaMarca(nino, cuenta, { tipo_registro: "manual", codigo_leido: null });
  await push(lote([marca]), cuenta);
  const cat = { ...cuenta, rolesPropios: ["catequista" as const] };
  const primero = await pull({ ultimoPulso: null, versionEsquema: 1 }, cat);
  expect(primero.experimentalStrategy).toBe("replacement");
  expect(Object.keys(primero.changes.catequizandos.created.find(fila => fila.id === nino)!).sort()).toEqual(["activo", "apellidos", "codigo_carne", "grupo_id", "id", "nombres"]);
  expect(primero.changes.asistencias.created.some(fila => fila.catequizando_id === nino)).toBe(true);
  const cambiado = await pull({ ultimoPulso: primero.timestamp, versionEsquema: 1, huellaAlcance: primero.huellaAlcance }, { ...cat, gruposAsignados: [] });
  expect(cambiado.experimentalStrategy).toBe("replacement");
  expect(cambiado.changes.asistencias.created).toEqual([]);
  const incremental = await pull({ ultimoPulso: primero.timestamp, versionEsquema: 1, huellaAlcance: primero.huellaAlcance }, cat);
  expect(incremental.experimentalStrategy).toBeUndefined();
  expect(incremental.changes.marcas_asistencia.created.some(fila => fila.id === marca.id)).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(primero))).toBeLessThan(100 * 1024);
});
test("RF-311 HU-306 RF-312: familia no recibe horas/autores y reporte usa seudónimo; sin lista no suma falta", async () => {
  const nino = await crearNino();
  const resumen = await consultarResumenAsistencia(nino, cicloId);
  expect(resumen).toMatchObject({ faltas: 0, domingos: [{ fecha, misa: "ausente", catequesis: "sin_registro" }] });
  expect(JSON.stringify(resumen)).not.toMatch(/hora|registrador|cuenta_id/);
  await push(lote([nuevaMarca(nino, cuenta, { tipo_registro: "manual", codigo_leido: null })]), cuenta);
  const reporte = await reporteMisa(fecha);
  expect(reporte.presentes.find(fila => fila.catequizandoId === nino)?.registradores).toEqual([cuenta.identidadOperativa]);
  expect(reporte.totalManuales).toBeGreaterThan(0);
});
test("RF-307 RF-802: ciclo cerrado descarta contenido y revocación rechaza todo", async () => {
  const nino = await crearNino(), entrada = lote([nuevaMarca(nino)]);
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("UPDATE ciclo SET estado='cerrado',cerrado_en=clock_timestamp(),cerrado_por=$2 WHERE id=$1", [cicloId, cuenta.cuentaId]);
    expect(await aplicarPush(entrada, cuenta, cliente)).toEqual({ aceptados: 0, rechazados: 0, descartadosCierre: 1 });
    expect((await cliente.query("SELECT id FROM marca_asistencia WHERE id=$1", [entrada.changes.marcas_asistencia.created[0].id])).rowCount).toBe(0);
    await cliente.query("ROLLBACK; BEGIN");
    await cliente.query("UPDATE credencial SET estado='terminada' WHERE id=$1", [cuenta.credencialId]);
    await expect(aplicarPush(entrada, cuenta, cliente)).rejects.toMatchObject({ estado: 401 });
  } finally { await cliente.query("ROLLBACK"); cliente.release(); }
});
test("RNF-303 RF-308: 50 clientes concurrentes y reenvíos conservan 50 marcas y un consolidado", async () => {
  const nino = await crearNino();
  const cuentas = [];
  for (let indice = 0; indice < 50; indice++) cuentas.push(await crearCuenta(`carga-${indice}`));
  const entradas = cuentas.map(autor => lote([nuevaMarca(nino, autor)]));
  const resultados = await Promise.all(cuentas.map((autor, indice) => push(entradas[indice], autor)));
  expect(resultados.every(resultado => resultado.aceptados === 1 && resultado.rechazados === 0)).toBe(true);
  await Promise.all(cuentas.map((autor, indice) => push(entradas[indice], autor)));
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM marca_asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(50);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(1);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM evento_asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(1);
  expect((await pool.query("SELECT count(DISTINCT registrado_por)::int AS cantidad FROM marca_asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(50);
}, 60000);
test("RF-106 RF-108 RF-308: retención exige contexto incluso en ciclo cerrado y elimina QR inválido con UUID en mayúsculas", async () => {
  const nino = await crearNino();
  await push(lote([nuevaMarca(nino)]), cuenta);
  const codigoInvalido = nuevaMarca(null, cuenta, { codigo_leido: `sgc1:${nino.toUpperCase()}:1` });
  expect((await push(lote([codigoInvalido]), cuenta)).rechazados).toBe(1);
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("UPDATE ciclo SET estado='cerrado',cerrado_en=clock_timestamp(),cerrado_por=$2 WHERE id=$1", [cicloId, cuenta.cuentaId]);
    await cliente.query("SET LOCAL ROLE sigecat_retencion");
    await expect(participanteRetencionAsistencia.alRetirarConsentimiento(nino, cliente)).rejects.toMatchObject({ estado: 403 });
    await cliente.query("SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
    expect((await participanteRetencionAsistencia.alRetirarConsentimiento(nino, cliente)).cantidad).toBe(1);
    const marcas = await cliente.query("SELECT catequizando_id,codigo_leido,registrado_por,cuenta_id,estadistico_id FROM marca_asistencia WHERE estadistico_id IS NOT NULL");
    expect(marcas.rows).toHaveLength(2);
    for (const marca of marcas.rows) expect(marca).toMatchObject({ catequizando_id: null, codigo_leido: null, registrado_por: null, cuenta_id: null });
    expect(new Set(marcas.rows.map(marca => marca.estadistico_id)).size).toBe(1);
    expect((await participanteRetencionAsistencia.alRetirarConsentimiento(nino, cliente)).cantidad).toBe(0);
  } finally { await cliente.query("ROLLBACK; RESET ROLE"); cliente.release(); }
});
test("RF-302 RF-312 HU-306 RNF-307: HTTP real verifica JWT/rol/alcance y la familia no recibe horas", async () => {
  const invocacion = new InvocationContext({ functionName: "asistenciaPrueba" });
  const nino = await crearNino(), ajeno = await crearNino();
  const familiaId = randomUUID(), credencialFamilia = randomUUID();
  await pool.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Familia de prueba',false)", [familiaId]);
  await pool.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'familia')", [familiaId]);
  await pool.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'familia',$3,'activa')", [credencialFamilia, familiaId, randomBytes(32)]);
  const apoderado = (await pool.query("SELECT apoderado_id FROM consentimiento WHERE catequizando_id=$1", [nino])).rows[0].apoderado_id;
  await pool.query("UPDATE apoderado SET cuenta_id=$2 WHERE id=$1", [apoderado, familiaId]);
  await pool.query("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'madre')", [randomUUID(), nino, apoderado]);
  const jwtFamilia = await firmarJwt({ cuentaId: familiaId, credencialId: credencialFamilia, tipo: "familia" });
  const jwtEquipo = await firmarJwt({ cuentaId: cuenta.cuentaId, credencialId: cuenta.credencialId, tipo: "equipo", dispositivoId: cuenta.dispositivoId });
  const peticion = (ruta: string, jwt?: string, params: Record<string, string> = {}, cabeceras: Record<string, string> = {}) => new HttpRequest({ method: "GET", url: `http://localhost/api/${ruta}`, headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), ...cabeceras }, params });
  expect((await manejadoresSincronizacion.pull(peticion("sincronizacion/cambios"), invocacion)).status).toBe(401);
  expect((await manejadoresSincronizacion.pull(peticion("sincronizacion/cambios", jwtFamilia), invocacion)).status).toBe(403);
  expect((await manejadoresAsistencia.reporteMisa(peticion(`asistencia/misas/${fecha}/reporte`, jwtFamilia, { fecha }), invocacion)).status).toBe(403);
  const propio = await manejadoresAsistencia.domingos(peticion(`asistencia/catequizandos/${nino}/domingos`, jwtFamilia, { id: nino }), invocacion);
  expect(propio.status).toBe(200);
  expect(JSON.stringify(propio.jsonBody)).not.toMatch(/hora|registrador|cuenta_id/);
  expect((await manejadoresAsistencia.domingos(peticion(`asistencia/catequizandos/${ajeno}/domingos`, jwtFamilia, { id: ajeno }), invocacion)).status).toBe(403);
  const carne = await manejadoresAsistencia.validarCarne(peticion("asistencia/carnes/codigo/validacion", jwtEquipo, { codigo: `SGC1:${nino}:1` }), invocacion);
  expect(carne.jsonBody).toEqual({ estado: "valido" });
  const comprimido = await manejadoresSincronizacion.pull(peticion("sincronizacion/cambios?versionEsquema=1", jwtEquipo, {}, { "Accept-Encoding": "gzip" }), invocacion);
  expect(comprimido.status).toBe(200);
  const cabeceras = new Headers(comprimido.headers);
  expect(cabeceras.get("content-encoding")).toBe("gzip");
  expect(cabeceras.get("cache-control")).toBe("no-store");
  const cuerpo = JSON.parse(gunzipSync(comprimido.body as Uint8Array).toString("utf8"));
  expect(cuerpo).toHaveProperty("changes.catequizandos.created");
  expect(cuerpo).toHaveProperty("timestamp");
});
test("RF-307 RNF-304: límite de 512 KB funciona sin Content-Length y cuenta bytes UTF-8", async () => {
  const pequeno = new HttpRequest({ method: "POST", url: "http://localhost/api/sincronizacion/cambios", body: { string: '{"changes":{}}' } });
  expect(await leerCuerpoAcotado(pequeno)).toBe('{"changes":{}}');
  const grande = new HttpRequest({ method: "POST", url: "http://localhost/api/sincronizacion/cambios", body: { bytes: Buffer.alloc(512 * 1024 + 1) } });
  await expect(leerCuerpoAcotado(grande)).rejects.toMatchObject({ estado: 413 });
});
test("RF-307 RNF-302 RF-311: dos dispositivos preparan domingo offline y sincronizan íntegro con corrección y justificación por puerto", async () => {
  const grupo = randomUUID();
  await pool.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Domingo sin red',8,13,'mixto')", [grupo, cicloId]);
  await pool.query("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id,desde) VALUES($1,$2,$3,'2020-01-01T05:00:00Z')", [randomUUID(), grupo, cuenta.cuentaId]);
  const ninos = [await crearNino(grupo), await crearNino(grupo), await crearNino(grupo)];
  const nomina: NinoNomina[] = ninos.map(id => ({ id, nombres: "Niño", apellidos: "Prueba", grupoId: grupo, activo: true, codigoCarne: `SGC1:${id}:1` }));
  const misa = { id: sesionId, cicloId, fecha, tipo: "misa" as const, cancelada: false };
  const horaMisa = `${fecha}T08:00:00-05:00`, horaLista = `${fecha}T10:00:00-05:00`;
  const escaneo = procesarEscaneo({ cuenta, sesion: misa, codigo: nomina[0].codigoCarne!, nomina, conConexion: false, existentes: [], id: randomUUID(), horaDispositivo: horaMisa, desfaseRelojMs: 0 });
  expect(escaneo.marca).toBeDefined();
  const manual = { ...escaneo.marca!, id: randomUUID(), catequizandoId: ninos[1], codigoLeido: null, tipoRegistro: "manual" as const };
  const borrador = alternar(alternar(abrirLista(nomina), ninos[1]), ninos[2]);
  const confirmado = confirmarLista({ borrador, cuenta: otraCuenta, sesion: { ...misa, id: catequesisId, tipo: "catequesis" }, grupoId: grupo, id: randomUUID(), generarId: randomUUID, abiertaEn: `${fecha}T09:59:00-05:00`, hora: horaLista, desfaseRelojMs: 0 });
  const correccion = correccionAFila({ id: randomUUID(), cicloId, sesionId: catequesisId, catequizandoId: ninos[1], valorAnterior: "ausente", valorNuevo: "presente", corregidoPor: otraCuenta.cuentaId, credencialId: otraCuenta.credencialId, horaDispositivo: `${fecha}T10:05:00-05:00`, desfaseRelojMs: 0, recibidoEn: new Date().toISOString(), estado: "aceptada" }, otraCuenta.dispositivoId!);
  const primerDispositivo = { changes: { marcas_asistencia: { created: [marcaAFila(escaneo.marca!), marcaAFila(manual)], updated: [], deleted: [] } } };
  const segundoDispositivo = { changes: { listas_asistencia: { created: [listaAFila(confirmado.lista)], updated: [], deleted: [] }, marcas_asistencia: { created: confirmado.marcas.map(marcaAFila), updated: [], deleted: [] }, correcciones_asistencia: { created: [correccion], updated: [], deleted: [] } } };
  expect((await push(primerDispositivo, cuenta)).aceptados).toBe(2);
  expect((await push(segundoDispositivo, otraCuenta)).aceptados).toBe(5);
  await push(primerDispositivo, cuenta); await push(segundoDispositivo, otraCuenta);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM marca_asistencia WHERE catequizando_id=ANY($1::uuid[])", [ninos])).rows[0].cantidad).toBe(5);
  expect((await consultarResumenAsistencia(ninos[1], cicloId)).faltas).toBe(0);
  expect((await consultarResumenAsistencia(ninos[2], cicloId)).faltas).toBe(1);
  registrarFuenteJustificaciones({ consultar: async () => [{ catequizandoId: ninos[2], fecha }] });
  expect((await consultarResumenAsistencia(ninos[2], cicloId)).faltas).toBe(0);
  const recibido = await pull({ ultimoPulso: null, versionEsquema: 1 }, cuenta);
  expect(recibido.changes.marcas_asistencia.created.filter(fila => ninos.includes(String(fila.catequizando_id)))).toHaveLength(5);
  expect(Buffer.byteLength(JSON.stringify(primerDispositivo)) + Buffer.byteLength(JSON.stringify(segundoDispositivo)) + Buffer.byteLength(JSON.stringify(recibido))).toBeLessThan(100 * 1024);
});
test("RF-304 RF-305 RF-311: vigencia y grupo se resuelven en la fecha histórica aunque hoy esté inactivo o en otro grupo", async () => {
  const anteriorPropio = await crearNino(grupoId), anteriorAjeno = await crearNino(grupoAjeno);
  for (const [nino, nuevoGrupo] of [[anteriorPropio, grupoAjeno], [anteriorAjeno, grupoId]]) {
    const inscripcion = (await pool.query("SELECT id FROM inscripcion WHERE catequizando_id=$1 AND ciclo_id=$2", [nino, cicloId])).rows[0].id;
    await pool.query("UPDATE asignacion_grupo SET hasta='2020-10-05T05:00:00Z' WHERE inscripcion_id=$1", [inscripcion]);
    await pool.query("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,'2020-10-05T05:00:00Z')", [randomUUID(), inscripcion, nuevoGrupo, cuenta.cuentaId]);
  }
  await pool.query("UPDATE inscripcion SET estado='anulada',hasta='2020-10-06T05:00:00Z',anulada_en='2020-10-06T05:00:00Z',anulada_por=$2,motivo_anulacion='Fin del periodo' WHERE catequizando_id=$1", [anteriorPropio, cuenta.cuentaId]);
  await pool.query("UPDATE catequizando SET estado='inactivo' WHERE id=$1", [anteriorPropio]);
  const propia = nuevaMarca(anteriorPropio, cuenta, { tipo_registro: "manual", codigo_leido: null });
  const ajena = nuevaMarca(anteriorAjeno, cuenta, { tipo_registro: "manual", codigo_leido: null });
  expect(await push(lote([propia, ajena]), cuenta)).toEqual({ aceptados: 1, rechazados: 1, descartadosCierre: 0 });
  expect((await pool.query("SELECT estado,motivo_rechazo FROM marca_asistencia WHERE id=$1", [ajena.id])).rows[0]).toEqual({ estado: "rechazada", motivo_rechazo: "manual_fuera_de_alcance" });
  expect((await consultarResumenAsistencia(anteriorPropio, cicloId)).domingos.find(domingo => domingo.fecha === fecha)).toMatchObject({ misa: "presente", catequesis: "sin_registro" });
  expect((await reporteMisa(fecha)).presentes.some(nino => nino.catequizandoId === anteriorPropio)).toBe(true);
});
test("RF-302 RF-309: desfases válidos preservan hora original; límite, futuro y preactivación se rechazan sin falsos presentes", async () => {
  const nino = await crearNino(), autor = await crearCuenta("reloj");
  await pool.query("UPDATE credencial SET emitida_en=$2,activada_en=$2 WHERE id=$1", [autor.credencialId, `${fecha}T07:30:00-05:00`]);
  const adelantada = nuevaMarca(nino, autor, { hora_dispositivo: Date.parse(`${fecha}T09:00:00-05:00`), desfase_reloj_ms: -3600000 });
  const atrasada = nuevaMarca(nino, autor, { hora_dispositivo: Date.parse(`${fecha}T07:00:00-05:00`), desfase_reloj_ms: 3600000 });
  const limite = nuevaMarca(nino, autor, { hora_dispositivo: Date.parse(`${fecha}T09:40:00-05:00`) });
  const fuera = nuevaMarca(nino, autor, { hora_dispositivo: Date.parse(`${fecha}T09:40:00.001-05:00`) });
  const futura = nuevaMarca(nino, autor, { hora_dispositivo: Date.now() + 60000 });
  const preactivacion = nuevaMarca(nino, autor, { hora_dispositivo: Date.parse(`${fecha}T07:29:00-05:00`) });
  expect(await push(lote([adelantada, atrasada, limite, fuera, futura, preactivacion]), autor)).toEqual({ aceptados: 3, rechazados: 3, descartadosCierre: 0 });
  const horas = await pool.query<{ id: string; hora_dispositivo: Date; recibido_en: Date; estado: string }>("SELECT id,hora_dispositivo,recibido_en,estado FROM marca_asistencia WHERE catequizando_id=$1", [nino]);
  expect(horas.rows.find(fila => fila.id === adelantada.id)?.hora_dispositivo.getTime()).toBe(adelantada.hora_dispositivo);
  expect(horas.rows.find(fila => fila.id === atrasada.id)?.hora_dispositivo.getTime()).toBe(atrasada.hora_dispositivo);
  for (const invalida of [fuera, futura, preactivacion]) expect(horas.rows.find(fila => fila.id === invalida.id)?.estado).toBe("rechazada");
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM aviso_asistencia WHERE marca_id=ANY($1::uuid[])", [[fuera.id, futura.id, preactivacion.id]])).rows[0].cantidad).toBe(3);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(1);
  const otro = await crearNino();
  await expect(push(lote([nuevaMarca(otro, autor, { desfase_reloj_ms: 86400001 })]), autor)).rejects.toMatchObject({ estado: 422 });
  expect((await pool.query("SELECT id FROM asistencia WHERE catequizando_id=$1", [otro])).rowCount).toBe(0);
});
test("RF-309: plazo usa el domingo Lima del dispositivo y después solo COORD con motivo, aun si el autor no tiene grupo", async () => {
  const nino = await crearNino(grupoAjeno), autor = await crearCuenta("autor-sin-grupo");
  await pool.query("DELETE FROM rol_cuenta WHERE cuenta_id=$1 AND rol='coordinacion'", [autor.cuentaId]);
  await push(lote([nuevaMarca(nino, autor)]), autor);
  const correccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, valor_anterior: "presente", valor_nuevo: "ausente", corregido_por: autor.cuentaId, cuenta_id: autor.cuentaId, credencial_id: autor.credencialId, dispositivo_id: autor.dispositivoId, hora_dispositivo: Date.parse(`${fecha}T23:59:59-05:00`), desfase_reloj_ms: 0 };
  const entrada = (fila: typeof correccion & { motivo?: string }) => ({ changes: { correcciones_asistencia: { created: [fila], updated: [], deleted: [] } } });
  expect(await push(entrada(correccion), autor)).toEqual({ aceptados: 1, rechazados: 0, descartadosCierre: 0 });
  const posterior = { ...correccion, id: randomUUID(), valor_anterior: "ausente", valor_nuevo: "presente", hora_dispositivo: Date.parse("2020-10-05T00:00:00-05:00") };
  expect((await push(entrada(posterior), autor)).rechazados).toBe(1);
  const coordinacion = { ...posterior, id: randomUUID(), corregido_por: cuenta.cuentaId, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId };
  expect((await push(entrada(coordinacion), cuenta)).rechazados).toBe(1);
  expect((await push(entrada({ ...coordinacion, id: randomUUID(), motivo: "Presencia corroborada" }), cuenta)).aceptados).toBe(1);
  expect((await pool.query("SELECT valor,corregida FROM asistencia WHERE sesion_id=$1 AND catequizando_id=$2", [sesionId, nino])).rows[0]).toEqual({ valor: "presente", corregida: true });
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM correccion_asistencia WHERE catequizando_id=$1 AND estado='aceptada'", [nino])).rows[0].cantidad).toBe(2);
});
test("RF-301 RF-311 RF-313: actividad 0505 vigente crea una sesión idempotente, expone cumplimiento y cancelada no genera falta", async () => {
  const actividadId = randomUUID(), nino = await crearNino();
  await pool.query("INSERT INTO actividad_obligatoria(id,ciclo_id,nombre,tipo,fecha,estado,creado_por) VALUES($1,$2,'Jornada de prueba','jornada',$3,'vigente',$4)", [actividadId, cicloId, fecha, cuenta.cuentaId]);
  const actividadSesion = await crearSesionActividad(actividadId);
  expect(await crearSesionActividad(actividadId)).toBe(actividadSesion);
  expect(actividadSesion).toBe(idSesion(cicloId, fecha, "actividad", actividadId));
  expect((await consultarCumplimientoActividad(actividadId)).find(fila => fila.catequizandoId === nino)).toMatchObject({ estado: "ausente" });
  expect((await consultarResumenAsistencia(nino, cicloId)).faltas).toBe(1);
  expect((await push(lote([nuevaMarca(nino, cuenta, { sesion_id: actividadSesion })]), cuenta)).aceptados).toBe(1);
  expect((await consultarCumplimientoActividad(actividadId)).find(fila => fila.catequizandoId === nino)).toMatchObject({ estado: "presente", registradores: [cuenta.identidadOperativa] });
  const sinRegistro = await crearNino();
  await pool.query("UPDATE actividad_obligatoria SET estado='cancelada' WHERE id=$1", [actividadId]);
  expect((await consultarResumenAsistencia(sinRegistro, cicloId)).faltas).toBe(0);
  expect((await consultarCumplimientoActividad(actividadId)).find(fila => fila.catequizandoId === sinRegistro)).toMatchObject({ estado: "no_aplica" });
  expect((await push(lote([nuevaMarca(sinRegistro, cuenta, { sesion_id: actividadSesion })]), cuenta)).rechazados).toBe(1);
});
test("RF-106 RF-307: retiro después de anulación entrega ids anteriores aun sin cambio de huella y purga clientes CAT/COORD", async () => {
  const nino = await crearNino(), autor = await crearCuenta("lapidas-autor"), observador = await crearCuenta("lapidas-grupo"), ajeno = await crearCuenta("lapidas-ajeno");
  for (const cat of [autor, observador, ajeno]) {
    await pool.query("DELETE FROM rol_cuenta WHERE cuenta_id=$1 AND rol='coordinacion'", [cat.cuentaId]);
    cat.rolesPropios = ["catequista"];
    cat.gruposAsignados = cat === ajeno ? [] : [grupoId];
    if (cat !== ajeno) await pool.query("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id,desde) VALUES($1,$2,$3,'2020-01-01T05:00:00Z')", [randomUUID(), grupoId, cat.cuentaId]);
  }
  const marca = nuevaMarca(nino, autor);
  await push(lote([marca]), autor);
  const correccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, valor_anterior: "presente", valor_nuevo: "ausente", corregido_por: autor.cuentaId, cuenta_id: autor.cuentaId, credencial_id: autor.credencialId, dispositivo_id: autor.dispositivoId, hora_dispositivo: Date.parse(`${fecha}T10:00:00-05:00`), desfase_reloj_ms: 0 };
  expect((await push({ changes: { correcciones_asistencia: { created: [correccion], updated: [], deleted: [] } } }, autor)).aceptados).toBe(1);
  const idAnterior = (await pool.query("SELECT id FROM asistencia WHERE catequizando_id=$1", [nino])).rows[0].id;
  const destinatarios = [autor, observador, cuenta];
  const clientes = destinatarios.map(() => new Map<string, Set<string>>());
  const iniciales = await Promise.all(destinatarios.map(ctx => pull({ ultimoPulso: null, versionEsquema: 1 }, ctx)));
  iniciales.forEach((respuesta, indice) => aplicarAlCliente(clientes[indice], respuesta));
  expect(clientes[0].get("marcas_asistencia")?.has(marca.id)).toBe(true);
  expect(clientes[1].get("correcciones_asistencia")?.has(correccion.id)).toBe(true);
  await pool.query("UPDATE inscripcion SET estado='anulada',hasta=clock_timestamp(),anulada_en=clock_timestamp(),anulada_por=$2,motivo_anulacion='Anulación previa' WHERE catequizando_id=$1", [nino, cuenta.cuentaId]);
  await pool.query("UPDATE asignacion_grupo SET hasta=clock_timestamp() WHERE hasta IS NULL AND inscripcion_id IN (SELECT id FROM inscripcion WHERE catequizando_id=$1)", [nino]);
  await pool.query("UPDATE carne_emision SET invalidada_en=clock_timestamp() WHERE catequizando_id=$1", [nino]);
  await pool.query("UPDATE catequizando SET estado='inactivo' WHERE id=$1", [nino]);
  const trasAnulacion = await Promise.all(destinatarios.map((ctx, indice) => pull({ ultimoPulso: iniciales[indice].timestamp, huellaAlcance: iniciales[indice].huellaAlcance, versionEsquema: 1 }, ctx)));
  trasAnulacion.forEach((respuesta, indice) => aplicarAlCliente(clientes[indice], respuesta));
  expect(trasAnulacion.every(respuesta => respuesta.experimentalStrategy === "replacement")).toBe(true);
  expect(clientes[0].get("marcas_asistencia")?.has(marca.id)).toBe(true);
  expect(clientes[0].get("correcciones_asistencia")?.has(correccion.id)).toBe(true);
  expect(clientes[2].get("asistencias")?.has(idAnterior)).toBe(true);
  await retirarEnTransaccion(nino);
  const posteriores = await Promise.all(destinatarios.map((ctx, indice) => pull({ ultimoPulso: trasAnulacion[indice].timestamp, huellaAlcance: trasAnulacion[indice].huellaAlcance, versionEsquema: 1 }, ctx)));
  posteriores.forEach((respuesta, indice) => {
    expect(respuesta.experimentalStrategy).toBeUndefined();
    expect(respuesta.huellaAlcance).toBe(trasAnulacion[indice].huellaAlcance);
    expect(respuesta.changes.asistencias.deleted).toContain(idAnterior);
    expect(respuesta.changes.marcas_asistencia.deleted).toContain(marca.id);
    expect(respuesta.changes.correcciones_asistencia.deleted).toContain(correccion.id);
    aplicarAlCliente(clientes[indice], respuesta);
    expect(clientes[indice].get("asistencias")?.has(idAnterior)).toBe(false);
    expect(clientes[indice].get("marcas_asistencia")?.has(marca.id)).toBe(false);
    expect(clientes[indice].get("correcciones_asistencia")?.has(correccion.id)).toBe(false);
  });
  const excluido = await pull({ ultimoPulso: null, versionEsquema: 1 }, ajeno);
  expect(excluido.changes.marcas_asistencia.deleted).not.toContain(marca.id);
  expect(excluido.changes.asistencias.deleted).not.toContain(idAnterior);
  const estadistica = (await pool.query("SELECT id,catequizando_id,estadistico_id FROM asistencia WHERE estadistico_id IS NOT NULL AND sesion_id=$1", [sesionId])).rows.find(fila => fila.id !== idAnterior);
  expect(estadistica).toMatchObject({ catequizando_id: null });
  const columnas = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='lapida_sincronizacion' ORDER BY ordinal_position", [esquema])).rows.map(fila => fila.column_name);
  expect(columnas).toEqual(["tabla", "fila_id", "cuenta_id", "ciclo_id", "eliminado_en"]);
  const cantidad = (await pool.query("SELECT count(*)::int AS cantidad FROM lapida_sincronizacion WHERE fila_id=ANY($1::uuid[])", [[idAnterior, marca.id, correccion.id]])).rows[0].cantidad;
  await retirarEnTransaccion(nino);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM lapida_sincronizacion WHERE fila_id=ANY($1::uuid[])", [[idAnterior, marca.id, correccion.id]])).rows[0].cantidad).toBe(cantidad);
});
test("RF-106 RF-307: pendientes nuevos tras retiro rechazan sin reintroducir UUID, QR, motivo personal ni duplicar avisos", async () => {
  const nino = await crearNino();
  await retirarEnTransaccion(nino);
  const qr = nuevaMarca(nino), manual = nuevaMarca(nino, cuenta, { tipo_registro: "manual", codigo_leido: null });
  const malformado = nuevaMarca(null, cuenta, { codigo_leido: `sgc1:${nino.toUpperCase()}:1` });
  const correccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, valor_anterior: "presente", valor_nuevo: "ausente", motivo: `Ana Prueba ${nino}`, corregido_por: cuenta.cuentaId, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId, hora_dispositivo: Date.parse(`${fecha}T10:00:00-05:00`), desfase_reloj_ms: 0 };
  const entrada = { changes: { ...lote([qr, manual, malformado]).changes, correcciones_asistencia: { created: [correccion], updated: [], deleted: [] } } };
  expect(await push(entrada, cuenta)).toEqual({ aceptados: 0, rechazados: 4, descartadosCierre: 0 });
  expect(await push(entrada, cuenta)).toEqual({ aceptados: 0, rechazados: 4, descartadosCierre: 0 });
  const marcas = await pool.query("SELECT catequizando_id,codigo_leido,cuenta_id,estado,motivo_rechazo FROM marca_asistencia WHERE id=ANY($1::uuid[])", [[qr.id, manual.id, malformado.id]]);
  for (const fila of marcas.rows) expect(fila).toEqual({ catequizando_id: null, codigo_leido: null, cuenta_id: cuenta.cuentaId, estado: "rechazada", motivo_rechazo: "nino_inactivo" });
  expect((await pool.query("SELECT catequizando_id,motivo,cuenta_id,estado,motivo_rechazo FROM correccion_asistencia WHERE id=$1", [correccion.id])).rows[0]).toEqual({ catequizando_id: null, motivo: null, cuenta_id: cuenta.cuentaId, estado: "rechazada", motivo_rechazo: "nino_inactivo" });
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM aviso_asistencia WHERE marca_id=ANY($1::uuid[])", [[qr.id, manual.id, malformado.id]])).rows[0].cantidad).toBe(3);
  const respuesta = await pull({ ultimoPulso: null, versionEsquema: 1 }, cuenta);
  const propios = [...respuesta.changes.marcas_asistencia.created, ...respuesta.changes.correcciones_asistencia.created].filter(fila => [qr.id, manual.id, malformado.id, correccion.id].includes(fila.id));
  expect(propios).toHaveLength(4);
  expect(JSON.stringify(propios).toLowerCase()).not.toContain(nino);
  expect(JSON.stringify(propios)).not.toContain("SGC1:");
  expect(JSON.stringify(propios)).not.toContain("Ana Prueba");
});
test("RF-106 RF-307: push bloqueado por retiro lee el estado anonimizado al continuar y no restaura datos", async () => {
  const nino = await crearNino(), marca = nuevaMarca(nino);
  const retiro = await pool.connect(), envio = await pool.connect();
  let pendiente: Promise<ResumenPush> | undefined;
  try {
    const pidRetiro = (await retiro.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const pidEnvio = (await envio.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    await retiro.query("BEGIN; SET LOCAL ROLE sigecat_retencion");
    await retiro.query("SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
    await retiro.query("SELECT id FROM catequizando WHERE id=$1 FOR UPDATE", [nino]);
    await envio.query("BEGIN");
    pendiente = aplicarPush(lote([marca]), cuenta, envio).then(async resumen => { await envio.query("COMMIT"); return resumen; });
    await esperarBloqueo(pidEnvio, pidRetiro);
    await anonimizarCatequizando(nino, retiro);
    await participanteRetencionAsistencia.alRetirarConsentimiento(nino, retiro);
    await retiro.query("COMMIT");
    expect(await pendiente).toEqual({ aceptados: 0, rechazados: 1, descartadosCierre: 0 });
    expect((await pool.query("SELECT catequizando_id,codigo_leido,estado,motivo_rechazo FROM marca_asistencia WHERE id=$1", [marca.id])).rows[0]).toEqual({ catequizando_id: null, codigo_leido: null, estado: "rechazada", motivo_rechazo: "nino_inactivo" });
    expect((await pool.query("SELECT id FROM asistencia WHERE catequizando_id=$1", [nino])).rowCount).toBe(0);
  } finally {
    await retiro.query("ROLLBACK");
    await pendiente?.catch(() => undefined);
    await envio.query("ROLLBACK");
    retiro.release(); envio.release();
  }
});
test("RF-106 RF-307: retiro bloqueado por un push espera el commit y anonimiza también la marca recién recibida", async () => {
  const nino = await crearNino(), marca = nuevaMarca(nino);
  const envio = await pool.connect(), retiro = await pool.connect();
  let pendiente: Promise<void> | undefined;
  try {
    const pidEnvio = (await envio.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const pidRetiro = (await retiro.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    await envio.query("BEGIN");
    expect((await aplicarPush(lote([marca]), cuenta, envio)).aceptados).toBe(1);
    await retiro.query("BEGIN; SET LOCAL ROLE sigecat_retencion");
    await retiro.query("SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
    pendiente = (async () => {
      await anonimizarCatequizando(nino, retiro);
      await participanteRetencionAsistencia.alRetirarConsentimiento(nino, retiro);
      await retiro.query("COMMIT");
    })();
    await esperarBloqueo(pidRetiro, pidEnvio);
    await envio.query("COMMIT");
    await pendiente;
    expect((await pool.query("SELECT catequizando_id,codigo_leido,cuenta_id FROM marca_asistencia WHERE id=$1", [marca.id])).rows[0]).toEqual({ catequizando_id: null, codigo_leido: null, cuenta_id: null });
    expect((await pool.query("SELECT fila_id FROM lapida_sincronizacion WHERE tabla='marcas_asistencia' AND fila_id=$1 AND cuenta_id=$2", [marca.id, cuenta.cuentaId])).rows).toEqual([{ fila_id: marca.id }]);
  } finally {
    await envio.query("ROLLBACK");
    await pendiente?.catch(() => undefined);
    await retiro.query("ROLLBACK");
    envio.release(); retiro.release();
  }
});
test("RF-106 RF-307: lápidas requieren rol y contexto, se entregan hasta sesenta días y el puerto depura solo vencidas", async () => {
  const vieja = randomUUID(), vigente = randomUUID(), cliente = await pool.connect();
  try {
    await cliente.query("BEGIN; SET LOCAL ROLE sigecat_retencion");
    await cliente.query("SAVEPOINT permiso");
    await expect(cliente.query("INSERT INTO lapida_sincronizacion(tabla,fila_id,cuenta_id,ciclo_id) VALUES('marcas_asistencia',$1,$2,$3)", [vieja, cuenta.cuentaId, cicloId])).rejects.toMatchObject({ code: "42501" });
    await cliente.query("ROLLBACK TO SAVEPOINT permiso");
    await cliente.query("SELECT set_config('sigecat.contexto','retencion',true)");
    await cliente.query("INSERT INTO lapida_sincronizacion(tabla,fila_id,cuenta_id,ciclo_id,eliminado_en) VALUES('marcas_asistencia',$1,$3,$4,clock_timestamp()-interval '61 days'),('marcas_asistencia',$2,$3,$4,clock_timestamp()-interval '59 days')", [vieja, vigente, cuenta.cuentaId, cicloId]);
    await cliente.query("COMMIT");
    const respuesta = await pull({ ultimoPulso: null, versionEsquema: 1 }, cuenta);
    expect(respuesta.changes.marcas_asistencia.deleted).toContain(vigente);
    expect(respuesta.changes.marcas_asistencia.deleted).not.toContain(vieja);
    await cliente.query("BEGIN; SET LOCAL ROLE sigecat_api; SAVEPOINT permiso");
    await expect(depurarLapidasSincronizacion(cliente)).rejects.toMatchObject({ code: "42501" });
    await cliente.query("ROLLBACK TO SAVEPOINT permiso; SET LOCAL ROLE sigecat_retencion");
    await cliente.query("SELECT set_config('sigecat.contexto','retencion',true)");
    expect(await depurarLapidasSincronizacion(cliente)).toBe(1);
    expect((await cliente.query("SELECT fila_id FROM lapida_sincronizacion WHERE fila_id=ANY($1::uuid[])", [[vieja, vigente]])).rows).toEqual([{ fila_id: vigente }]);
    await cliente.query("COMMIT");
  } finally { await cliente.query("ROLLBACK; RESET ROLE"); cliente.release(); }
});
test("RF-305 RF-309 RF-312: COORD corrige misa ausente calculada sin escaneo y reporte acredita manual con hora/autor reales", async () => {
  const nino = await crearNino(), coordinador = await crearCuenta("correccion-sin-escaneo");
  await pool.query("DELETE FROM rol_cuenta WHERE cuenta_id=$1 AND rol='catequista'", [coordinador.cuentaId]);
  coordinador.rolesPropios = ["coordinacion"];
  expect((await consultarResumenAsistencia(nino, cicloId)).domingos.find(domingo => domingo.fecha === fecha)?.misa).toBe("ausente");
  const hora = Date.now();
  const correccion: EntradaCorreccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, valor_anterior: "ausente", valor_nuevo: "presente", motivo: "Asistencia corroborada por coordinación", corregido_por: coordinador.cuentaId, cuenta_id: coordinador.cuentaId, credencial_id: coordinador.credencialId, dispositivo_id: coordinador.dispositivoId!, hora_dispositivo: hora, desfase_reloj_ms: 0 };
  const entrada = { changes: { correcciones_asistencia: { created: [{ ...correccion, _status: "created", _changed: "valor_nuevo", estado: "aceptada", motivo_rechazo: "cliente", recibido_en: 0 }], updated: [], deleted: [] } } };
  expect(await push(entrada, coordinador)).toEqual({ aceptados: 1, rechazados: 0, descartadosCierre: 0 });
  expect(await push(entrada, coordinador)).toEqual({ aceptados: 1, rechazados: 0, descartadosCierre: 0 });
  const persistida = (await pool.query("SELECT valor_anterior,valor_nuevo,corregido_por,hora_dispositivo,recibido_en FROM correccion_asistencia WHERE id=$1", [correccion.id])).rows[0];
  expect(persistida).toMatchObject({ valor_anterior: "ausente", valor_nuevo: "presente", corregido_por: coordinador.cuentaId });
  expect(persistida.hora_dispositivo.getTime()).toBe(hora);
  expect(persistida.recibido_en.getTime()).toBeGreaterThanOrEqual(hora);
  const asistencia = (await pool.query("SELECT valor,tipo_registro,corregida,hora_primer_registro,recibido_primer_registro FROM asistencia WHERE sesion_id=$1 AND catequizando_id=$2", [sesionId, nino])).rows[0];
  expect(asistencia).toMatchObject({ valor: "presente", tipo_registro: "manual", corregida: true });
  expect(asistencia.hora_primer_registro.getTime()).toBe(hora);
  expect(asistencia.recibido_primer_registro.getTime()).toBe(persistida.recibido_en.getTime());
  expect((await pool.query("SELECT id FROM marca_asistencia WHERE catequizando_id=$1", [nino])).rowCount).toBe(0);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM evento_asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(1);
  expect((await reporteMisa(fecha)).presentes.find(fila => fila.catequizandoId === nino)).toMatchObject({ tipoRegistro: "manual", registradores: [coordinador.identidadOperativa], horaDispositivo: new Date(hora).toISOString() });
});
test("RF-306 RF-309 RF-311: COORD corrige catequesis sin_registro sin fabricar lista y también ausencia de lista confirmada", async () => {
  const sinLista = randomUUID();
  await pool.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Corrección sin lista',8,13,'mixto')", [sinLista, cicloId]);
  const nino = await crearNino(sinLista);
  const correccion: EntradaCorreccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: catequesisId, catequizando_id: nino, valor_anterior: "sin_registro", valor_nuevo: "presente", motivo: "Registro omitido de catequesis corroborado", corregido_por: cuenta.cuentaId, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId!, hora_dispositivo: Date.now(), desfase_reloj_ms: 0 };
  expect((await consultarResumenAsistencia(nino, cicloId)).domingos.find(domingo => domingo.fecha === fecha)?.catequesis).toBe("sin_registro");
  expect((await push({ changes: { correcciones_asistencia: { created: [correccion], updated: [], deleted: [] } } }, cuenta)).aceptados).toBe(1);
  expect((await pool.query("SELECT valor_anterior FROM correccion_asistencia WHERE id=$1", [correccion.id])).rows[0].valor_anterior).toBe("sin_registro");
  expect((await pool.query("SELECT id FROM marca_asistencia WHERE catequizando_id=$1", [nino])).rowCount).toBe(0);
  expect((await consultarResumenAsistencia(nino, cicloId)).domingos.find(domingo => domingo.fecha === fecha)).toMatchObject({ misa: "ausente", catequesis: "presente" });
  const grupo = randomUUID();
  await pool.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Lista histórica confirmada',8,13,'mixto')", [grupo, cicloId]);
  const original = await crearNino(grupo);
  const confirmada = confirmarLista({ borrador: abrirLista([{ id: original }]), cuenta, sesion: { id: catequesisId, cicloId, fecha, tipo: "catequesis", cancelada: false }, grupoId: grupo, id: randomUUID(), generarId: randomUUID, abiertaEn: `${fecha}T09:59:00-05:00`, hora: `${fecha}T10:00:00-05:00`, desfaseRelojMs: 0 });
  expect((await push({ changes: { listas_asistencia: { created: [listaAFila(confirmada.lista)], updated: [], deleted: [] }, marcas_asistencia: { created: confirmada.marcas.map(marcaAFila), updated: [], deleted: [] } } }, cuenta)).rechazados).toBe(0);
  const sinMarca = await crearNino(grupo, `${fecha}T12:00:00-05:00`);
  const valida = { ...correccion, id: randomUUID(), catequizando_id: sinMarca, valor_anterior: "ausente" as const };
  expect((await consultarResumenAsistencia(sinMarca, cicloId)).domingos.find(domingo => domingo.fecha === fecha)?.catequesis).toBe("ausente");
  expect((await push({ changes: { correcciones_asistencia: { created: [valida], updated: [], deleted: [] } } }, cuenta)).aceptados).toBe(1);
});
test("RF-309: corrección sin marcas exige motivo y COORD tras domingo, rechaza anterior falso y niño ajeno a la fecha", async () => {
  const nino = await crearNino(), catequista = await crearCuenta("correccion-no-autorizada"), posterior = await crearNino(grupoId, "2020-10-05T05:00:00Z");
  await pool.query("DELETE FROM rol_cuenta WHERE cuenta_id=$1 AND rol='coordinacion'", [catequista.cuentaId]);
  catequista.rolesPropios = ["catequista"];
  const correccion: EntradaCorreccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: sesionId, catequizando_id: nino, valor_anterior: "ausente", valor_nuevo: "presente", motivo: "Verificación posterior", corregido_por: cuenta.cuentaId, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId!, hora_dispositivo: Date.now(), desfase_reloj_ms: 0 };
  const enviar = (fila: EntradaCorreccion, ctx = cuenta) => push({ changes: { correcciones_asistencia: { created: [fila], updated: [], deleted: [] } } }, ctx);
  const sinMotivo = { ...correccion, id: randomUUID(), motivo: null };
  const anteriorFalso = { ...correccion, id: randomUUID(), valor_anterior: "presente" as const };
  const ajena = { ...correccion, id: randomUUID(), catequizando_id: posterior };
  const sinAutor = { ...correccion, id: randomUUID(), corregido_por: catequista.cuentaId, cuenta_id: catequista.cuentaId, credencial_id: catequista.credencialId, dispositivo_id: catequista.dispositivoId! };
  const antesCierre = { ...correccion, id: randomUUID(), hora_dispositivo: Date.parse(`${fecha}T08:00:00-05:00`) };
  for (const invalida of [sinMotivo, anteriorFalso, ajena, antesCierre]) expect((await enviar(invalida)).rechazados).toBe(1);
  expect((await enviar(sinAutor, catequista)).rechazados).toBe(1);
  expect((await pool.query("SELECT id FROM asistencia WHERE catequizando_id=ANY($1::uuid[])", [[nino, posterior]])).rowCount).toBe(0);
  expect((await pool.query("SELECT estado,motivo_rechazo FROM correccion_asistencia WHERE id=$1", [anteriorFalso.id])).rows[0]).toEqual({ estado: "rechazada", motivo_rechazo: "valor_anterior_invalido" });
  await expect(enviar({ ...correccion, id: randomUUID(), valor_anterior: "inventado" } as unknown as EntradaCorreccion)).rejects.toMatchObject({ estado: 422 });
  const desconocido = randomUUID();
  expect((await enviar({ ...correccion, id: randomUUID(), catequizando_id: desconocido })).rechazados).toBe(1);
  expect((await pool.query("SELECT id FROM asistencia WHERE catequizando_id=$1", [desconocido])).rowCount).toBe(0);
});
test("RF-309 RF-308: correcciones concurrentes sin marcas no aceptan dos valores anteriores sin_registro", async () => {
  const grupo = randomUUID();
  await pool.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Correcciones concurrentes sin lista',8,13,'mixto')", [grupo, cicloId]);
  const nino = await crearNino(grupo);
  const primera: EntradaCorreccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: catequesisId, catequizando_id: nino, valor_anterior: "sin_registro", valor_nuevo: "presente", motivo: "Presencia corroborada", corregido_por: cuenta.cuentaId, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId!, hora_dispositivo: Date.now(), desfase_reloj_ms: 0 };
  const segunda: EntradaCorreccion = { ...primera, id: randomUUID(), valor_nuevo: "ausente", motivo: "Ausencia corroborada", corregido_por: otraCuenta.cuentaId, cuenta_id: otraCuenta.cuentaId, credencial_id: otraCuenta.credencialId, dispositivo_id: otraCuenta.dispositivoId! };
  const enviar = (fila: EntradaCorreccion, ctx: ContextoAcceso) => push({ changes: { correcciones_asistencia: { created: [fila], updated: [], deleted: [] } } }, ctx);
  const resultados = await Promise.all([enviar(primera, cuenta), enviar(segunda, otraCuenta)]);
  expect(resultados.map(resultado => resultado.aceptados).sort()).toEqual([0, 1]);
  expect(resultados.map(resultado => resultado.rechazados).sort()).toEqual([0, 1]);
  const filas = (await pool.query("SELECT valor_nuevo,estado,motivo_rechazo FROM correccion_asistencia WHERE catequizando_id=$1", [nino])).rows;
  expect(filas.filter(fila => fila.estado === "aceptada")).toHaveLength(1);
  expect(filas.find(fila => fila.estado === "rechazada")?.motivo_rechazo).toBe("valor_anterior_invalido");
  expect((await pool.query("SELECT valor FROM asistencia WHERE catequizando_id=$1", [nino])).rows).toEqual([{ valor: filas.find(fila => fila.estado === "aceptada")!.valor_nuevo }]);
  expect((await pool.query("SELECT count(*)::int AS cantidad FROM evento_asistencia WHERE catequizando_id=$1", [nino])).rows[0].cantidad).toBe(1);
});
