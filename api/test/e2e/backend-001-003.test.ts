import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { RespuestaPull, ResumenPush } from "@/lib/sincronizacion/protocolo";
import { idSesion } from "@/lib/asistencia/sesiones";
import { manejadoresSeguridad, manejarAcceso, retencionDiaria } from "../../src/modulos/seguridad/http";
import { manejadoresCatequizandos as catequizandos } from "../../src/modulos/catequizandos/http";
import { manejadoresInscripciones as inscripciones } from "../../src/modulos/inscripciones/http";
import { manejadoresAsistencia as asistencia } from "../../src/modulos/asistencia/http";
import { manejadoresSincronizacion as sincronizacion } from "../../src/modulos/sincronizacion/http";
import { registrarProveedorResumen, participanteRetencion } from "../../src/modulos/catequizandos";
import { registrarParticipanteRetencion, participanteSeguridad } from "../../src/modulos/seguridad";
import { participanteRetencionAsistencia, consultarResumenAsistencia } from "../../src/modulos/asistencia";
import { participanteRetencionAvisos, proveedorAvisos } from "../../src/modulos/avisos";
import { registrarProveedor } from "../../src/modulos/sincronizacion/aplicacion/registro-proveedores";
import { consultarPerfil } from "../../src/modulos/catequizandos/aplicacion/perfil";
import { cargarContexto } from "../../src/modulos/seguridad/aplicacion/contexto";
import { manejadoresAvisos } from "../../src/modulos/avisos/http";
import { manejadoresActividades } from "../../src/modulos/actividades/http";
import { exigir, llamar, crearEsquema, bootstrap, altaEquipo, grupo, datosInscripcion, inscribir, entrarFamilia, type Sesion } from "./soporte";

let pool: Pool, administracion: Pool, esquema: string;
jest.mock("../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (sql: string, parametros: unknown[]) => pool.query(sql, parametros) }));
// Los registros son los del arranque de producción; solo se sustituye el destino del pool SQL.
registrarProveedorResumen({ nombre: "resumenAsistencia", consultar: (id, cicloId, _ctx, tx) => consultarResumenAsistencia(id, cicloId, tx) });
registrarParticipanteRetencion(participanteRetencionAsistencia);
registrarParticipanteRetencion(participanteRetencion);
registrarParticipanteRetencion(participanteSeguridad);
registrarParticipanteRetencion(participanteRetencionAvisos);
registrarProveedor(proveedorAvisos);

let admin: Sesion, coord: Sesion, cat: Sesion, suplente: Sesion, sup: Sesion, fam: Sesion;
let cicloId: string, propio: string, ajeno: string;
let primera: ReturnType<typeof datosInscripcion>, segunda: ReturnType<typeof datosInscripcion>;
const fecha = "2026-01-04";
const anteriores = { JWT_CLAVE: process.env.JWT_CLAVE, URL_WEB: process.env.URL_WEB };
beforeAll(() => { process.env.JWT_CLAVE = "clave-e2e-local-sin-uso-en-produccion-001003"; process.env.URL_WEB = "https://sigecat.example"; });
afterAll(() => { for (const [nombre, valor] of Object.entries(anteriores)) { if (valor === undefined) delete process.env[nombre]; else process.env[nombre] = valor; } });
beforeEach(async () => {
  const bd = await crearEsquema(); pool = bd.api; administracion = bd.administracion; esquema = bd.esquema;
  expect((await pool.query("SELECT current_user AS rol")).rows[0].rol).toBe("sigecat_api");
  admin = await bootstrap(administracion);
  cicloId = randomUUID();
  await administracion.query("INSERT INTO ciclo(id,nombre,inicio,fin,estado,abierto_por) VALUES($1,'Ciclo E2E','2026-01-01','2026-12-31','abierto',$2)", [cicloId, admin.contexto.cuentaId]);
  coord = await altaEquipo(admin, "Coordinación E2E", ["coordinacion"]);
  cat = await altaEquipo(admin, "Luz E2E", ["catequista"], true);
  suplente = await altaEquipo(admin, "Suplente E2E", ["catequista"]);
  sup = await altaEquipo(admin, "Supervisión E2E", ["supervision"]);
  propio = await grupo(coord, cicloId, "Propio", cat); ajeno = await grupo(coord, cicloId, "Ajeno", suplente);
  primera = datosInscripcion(propio, "primera"); segunda = datosInscripcion(ajeno, "segunda");
  const resultado = await inscribir(coord, primera); await inscribir(coord, segunda);
  fam = await entrarFamilia(resultado.enlaces[0].url);
  // Fixture histórica explícita: la inscripción HTTP de hoy debe estar activa en el domingo consultado.
  await administracion.query("UPDATE inscripcion SET desde='2026-01-01T00:00:00-05:00'; UPDATE asignacion_grupo SET desde='2026-01-01T00:00:00-05:00'");
  await administracion.query("UPDATE credencial SET emitida_en='2026-01-01T00:00:00-05:00',activada_en='2026-01-01T00:00:00-05:00' WHERE tipo='equipo'");
  await administracion.query("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$3,$4,'misa'),($2,$3,$4,'catequesis')", [idSesion(cicloId, fecha, "misa"), idSesion(cicloId, fecha, "catequesis"), cicloId, fecha]);
}, 30000);
afterEach(async () => { if (pool) await pool.end(); if (administracion) { try { await administracion.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`); } finally { await administracion.end(); } } });

const cambios = (filas: unknown[]) => ({ created: filas, updated: [], deleted: [] });
function marca(nino: string | null, autor = cat, extras: Record<string, unknown> = {}) {
  return { id: randomUUID(), ciclo_id: cicloId, sesion_id: idSesion(cicloId, fecha, "misa"), catequizando_id: nino, codigo_leido: nino ? `SGC1:${nino}:1` : "ilegible", valor: "presente", tipo_registro: "escaneo", registrado_por: autor.contexto.cuentaId, cuenta_id: autor.contexto.cuentaId, credencial_id: autor.contexto.credencialId, dispositivo_id: autor.dispositivoId, hora_dispositivo: Date.parse(`${fecha}T08:00:00-05:00`), desfase_reloj_ms: 0, ...extras };
}
const pushMarcas = (marcas: unknown[], sesion = cat) => exigir<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", sesion, { changes: { marcas_asistencia: cambios(marcas) } });
const pull = (sesion = cat, anterior?: RespuestaPull) => exigir<RespuestaPull>(sincronizacion.pull, `sincronizacion/cambios?versionEsquema=1${anterior ? `&ultimoPulso=${anterior.timestamp}&huellaAlcance=${anterior.huellaAlcance}` : ""}`, sesion);
const perfil = (id: string, sesion: Sesion) => llamar(catequizandos.perfil, `catequizandos/${id}/perfil`, sesion, undefined, { id });
const condiciones = (id: string, sesion: Sesion) => llamar(catequizandos.condiciones, `catequizandos/${id}/condiciones`, sesion, undefined, { id });
async function guardarCondicion(id = primera.nino.id) {
  await exigir(catequizandos.guardarCondiciones, `catequizandos/${id}/condiciones`, coord, { condiciones: [{ id: randomUUID(), categoria: "alergia", nota: "Apoyo reservado E2E" }] }, { id }, "PUT");
}
async function lista(autor: Sesion, grupoId: string, ninos: string[], valor: "presente" | "ausente") {
  const id = randomUUID(), sesion = idSesion(cicloId, fecha, "catequesis"), hora = Date.parse(`${fecha}T10:00:00-05:00`);
  const fila = { id, ciclo_id: cicloId, sesion_id: sesion, grupo_id: grupoId, confirmada_por: autor.contexto.cuentaId, cuenta_id: autor.contexto.cuentaId, credencial_id: autor.contexto.credencialId, dispositivo_id: autor.dispositivoId, abierta_en: hora - 60000, confirmada_en: hora, desfase_reloj_ms: 0, total_presentes: valor === "presente" ? ninos.length : 0, total_ausentes: valor === "ausente" ? ninos.length : 0 };
  return { changes: { listas_asistencia: cambios([fila]), marcas_asistencia: cambios(ninos.map(n => marca(n, autor, { sesion_id: sesion, codigo_leido: null, tipo_registro: "lista", lista_id: id, valor, hora_dispositivo: hora }))) } };
}
async function corregir(autor: Sesion, valor = "presente", motivo?: string) {
  const correccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: idSesion(cicloId, fecha, "catequesis"), catequizando_id: primera.nino.id, valor_anterior: "ausente", valor_nuevo: valor, corregido_por: autor.contexto.cuentaId, cuenta_id: autor.contexto.cuentaId, credencial_id: autor.contexto.credencialId, dispositivo_id: autor.dispositivoId, hora_dispositivo: Date.parse(`${fecha}T11:00:00-05:00`), desfase_reloj_ms: 0, ...(motivo ? { motivo } : {}) };
  const resumen = await exigir<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", autor, { changes: { correcciones_asistencia: cambios([correccion]) } });
  return { correccion, resumen };
}

test("RF-101 RF-102 RF-105 RF-107 RF-109 RF-110 RF-111 RF-201 RF-202 RF-204 RF-205 RF-206 RNF-203 RNF-306: enlaces reales, roles SQL y nómina nativa mínima con denegación auditada", async () => {
  const yo = await exigir<ContextoAcceso>(manejadoresSeguridad.yo, "yo", cat);
  expect(yo.gruposAsignados).toEqual([propio]); expect(yo.esMenor).toBe(true); expect(yo.identidadOperativa).toBe("Luz E2E");
  expect(fam.contexto.catequizandosApoderados).toEqual([primera.nino.id]);
  await guardarCondicion();
  const leida = await condiciones(primera.nino.id, cat); expect(leida.estado).toBe(200); expect(leida.respuesta.headers).toMatchObject({ "Cache-Control": "no-store" });
  expect((await condiciones(primera.nino.id, fam)).estado).toBe(403);
  expect((await condiciones(primera.nino.id, suplente)).estado).toBe(403);
  expect((await perfil(segunda.nino.id, fam)).estado).toBe(403);
  expect((await perfil(primera.nino.id, sup)).estado).toBe(403);
  const sinToken = await llamar(catequizandos.perfil, "catequizandos/perfil", undefined, undefined, { id: primera.nino.id });
  expect(sinToken).toMatchObject({ estado: 401, datos: { codigo: "acceso_denegado" } });
  const documentos = await exigir<{ documentos: { tipo: string; estado: string }[] }>(inscripciones.documentos, "documentos", fam, undefined, { id: primera.id });
  expect(documentos.documentos).toHaveLength(5); expect(documentos.documentos.find(d => d.tipo === "partida_bautismo")?.estado).toBe("no_aplica");
  const nativa = await pull(); expect(nativa.experimentalStrategy).toBe("replacement");
  expect(nativa.changes.catequizandos.created.map(n => n.id).sort()).toEqual([primera.nino.id, segunda.nino.id].sort());
  for (const n of nativa.changes.catequizandos.created) expect(Object.keys(n).sort()).toEqual(["activo", "apellidos", "codigo_carne", "grupo_id", "id", "nombres"]);
  expect(JSON.stringify(nativa)).not.toMatch(/Apoyo reservado|fecha_nacimiento|valor_contacto|Nombre reservado/);
  const denegados = await administracion.query("SELECT accion,resultado,detalle FROM evento_auditoria WHERE cuenta_id=$1 AND resultado='denegado'", [suplente.contexto.cuentaId]);
  expect(denegados.rows).toEqual(expect.arrayContaining([expect.objectContaining({ accion: "restringido:leer", resultado: "denegado" })]));
  expect((await llamar(inscripciones.inscribir, "inscripciones", cat, datosInscripcion(propio, "prohibida"))).estado).toBe(403);
  const sinConsentimiento = { ...datosInscripcion(propio, "incompleta"), consentimiento: undefined };
  expect(await llamar(inscripciones.inscribir, "inscripciones", coord, sinConsentimiento)).toMatchObject({ estado: 422, datos: { codigo: "sin_consentimiento" } });
  expect((await administracion.query("SELECT id FROM catequizando WHERE id=$1", [sinConsentimiento.nino.id])).rowCount).toBe(0);
  expect((await llamar(catequizandos.guardarCondiciones, "condiciones", coord, { condiciones: [], diagnostico: "prohibido" }, { id: primera.nino.id }, "PUT")).estado).toBe(422);
  await expect(pool.query("SELECT * FROM identidad_real")).rejects.toMatchObject({ code: "42501" });
  await expect(pool.query("DELETE FROM evento_auditoria")).rejects.toMatchObject({ code: "42501" });
});

test("RF-201 RF-203 RF-204 RF-206 RF-207: correcciones y documentos conservan historia, cambio de grupo revoca alcance y familia con dos hijos conserva solo el vigente", async () => {
  const duplicada = { ...datosInscripcion(propio, "duplicada"), nino: { ...primera.nino, id: randomUUID() } };
  const duplicado = await llamar<{ codigo: string; referencia: string }>(inscripciones.inscribir, "inscripciones", coord, duplicada);
  expect(duplicado.estado).toBe(409); expect(Object.keys(duplicado.datos).sort()).toEqual(["codigo", "referencia"]);
  const confirmado = await exigir<{ catequizandoId: string }>(inscripciones.confirmarDuplicado, "inscripciones/duplicados/confirmar", coord, { referencia: duplicado.datos.referencia, esElMismo: true });
  expect(confirmado.catequizandoId).toBe(primera.nino.id);
  await exigir(inscripciones.inscribir, "inscripciones", coord, primera);
  const cambioId = randomUUID();
  await exigir(catequizandos.corregir, "catequizandos/corregir", coord, { datos: { nombres: "Nombre corregido" }, cambios: [{ id: cambioId, campo: "nombres" }] }, { id: primera.nino.id }, "PATCH");
  expect((await administracion.query("SELECT valor_anterior,valor_nuevo,cambiado_por FROM cambio_inscripcion WHERE id=$1", [cambioId])).rows[0]).toEqual({ valor_anterior: primera.nino.nombres, valor_nuevo: "Nombre corregido", cambiado_por: coord.contexto.cuentaId });
  await exigir(inscripciones.cambiarDocumento, "documentos", coord, { cambioId: randomUUID(), estado: "entregado", fechaEstado: fecha }, { id: primera.id, tipo: "documento_identidad" }, "PUT");
  expect((await llamar(inscripciones.cambiarDocumento, "documentos", coord, { cambioId: randomUUID(), estado: "invalido", fechaEstado: fecha }, { id: primera.id, tipo: "documento_identidad" }, "PUT")).estado).toBe(422);
  await exigir(inscripciones.cambiarDocumento, "documentos", coord, { cambioId: randomUUID(), estado: "invalido", fechaEstado: fecha, motivo: "Ilegible" }, { id: primera.id, tipo: "documento_identidad" }, "PUT");
  await guardarCondicion();
  await exigir(catequizandos.asignarGrupo, "inscripciones/grupo", coord, { id: randomUUID(), grupoId: ajeno, cambioId: randomUUID() }, { id: primera.id }, "PUT");
  expect((await condiciones(primera.nino.id, cat)).estado).toBe(403); expect((await condiciones(primera.nino.id, suplente)).estado).toBe(200);
  const historial = (await administracion.query("SELECT grupo_id,hasta FROM asignacion_grupo WHERE inscripcion_id=$1 ORDER BY desde", [primera.id])).rows;
  expect(historial).toHaveLength(2); expect(historial[0].hasta).not.toBeNull(); expect(historial[1]).toMatchObject({ grupo_id: ajeno, hasta: null });
  const hermano = datosInscripcion(ajeno, "hermana", primera.consentimiento!.apoderadoId); await inscribir(coord, hermano);
  expect((await exigir<ContextoAcceso>(manejadoresSeguridad.yo, "yo", fam)).catequizandosApoderados.sort()).toEqual([primera.nino.id, hermano.nino.id].sort());
  await exigir(catequizandos.desvincular, "apoderados/desvincular", coord, { cambioId: randomUUID() }, { id: primera.nino.id, apoderadoId: primera.consentimiento!.apoderadoId }, "DELETE");
  expect((await perfil(primera.nino.id, fam)).estado).toBe(403); expect((await perfil(hermano.nino.id, fam)).estado).toBe(200);
});

test("RF-301 RF-302 RF-303 RF-304 RF-305 RF-306 RF-307 RF-308 RF-309 RF-310 RF-311 RF-312 RNF-304 RNF-307: dos colas serializadas llegan por HTTP sin pérdida, reportes reales y corrección trazada", async () => {
  const inicial = await pull();
  const manual = marca(primera.nino.id, cat, { tipo_registro: "manual", codigo_leido: null });
  const escaneoAjeno = marca(segunda.nino.id), invalida = marca(null);
  const colaUno = JSON.stringify({ changes: { marcas_asistencia: cambios([manual, escaneoAjeno, invalida]) } });
  const colaDos = JSON.stringify(await lista(suplente, propio, [primera.nino.id], "ausente"));
  const enviadoUno = await llamar<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", cat, JSON.parse(colaUno));
  expect(enviadoUno).toMatchObject({ estado: 200, datos: { aceptados: 2, rechazados: 1, descartadosCierre: 0 } });
  const enviadoDos = await llamar<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", suplente, JSON.parse(colaDos));
  expect(enviadoDos).toMatchObject({ estado: 200, datos: { aceptados: 2, rechazados: 0, descartadosCierre: 0 } });
  await exigir(sincronizacion.push, "sincronizacion/cambios", cat, JSON.parse(colaUno));
  await exigir(sincronizacion.push, "sincronizacion/cambios", suplente, JSON.parse(colaDos));
  expect((await administracion.query("SELECT count(*)::int AS cantidad FROM marca_asistencia")).rows[0].cantidad).toBe(4);
  expect((await administracion.query("SELECT count(*)::int AS cantidad FROM asistencia")).rows[0].cantidad).toBe(3);
  const validacion = await exigir(asistencia.validarCarne, "asistencia/carnes/validacion", cat, undefined, { codigo: `SGC1:${segunda.nino.id}:1` });
  expect(validacion).toEqual({ estado: "valido" });
  const reporte = await exigir<{ totalPresentes: number; totalActivos: number; totalManuales: number; presentes: { catequizandoId: string; registradores: string[] }[] }>(asistencia.reporteMisa, "asistencia/reporte", sup, undefined, { fecha });
  expect(reporte).toMatchObject({ totalPresentes: 2, totalActivos: 2, totalManuales: 1 });
  expect(reporte.presentes.find(n => n.catequizandoId === primera.nino.id)?.registradores).toEqual(["Luz E2E"]);
  expect(JSON.stringify(reporte)).not.toContain("Nombre reservado");
  const familiar = await exigir(asistencia.domingos, "asistencia/domingos", fam, undefined, { id: primera.nino.id });
  expect(familiar).toMatchObject({ domingos: [{ fecha, misa: "presente", catequesis: "ausente" }], faltas: 0 }); expect(JSON.stringify(familiar)).not.toMatch(/hora|registrador|Luz E2E/);
  const avisos = await exigir<{ tipo: string }[]>(asistencia.listarAvisos, "asistencia/avisos", coord);
  expect(avisos.map(a => a.tipo)).toEqual(expect.arrayContaining(["revision_cruzada", "rechazo_registro"]));
  expect((await corregir(cat)).resumen.rechazados).toBe(1);
  const corregida = await corregir(suplente); expect(corregida.resumen.aceptados).toBe(1);
  expect((await administracion.query("SELECT valor_anterior,valor_nuevo,corregido_por FROM correccion_asistencia WHERE id=$1", [corregida.correccion.id])).rows[0]).toMatchObject({ valor_anterior: "ausente", valor_nuevo: "presente", corregido_por: suplente.contexto.cuentaId });
  const eventos = await administracion.query("SELECT tipo FROM evento_asistencia WHERE catequizando_id=$1", [primera.nino.id]); expect(eventos.rowCount).toBeGreaterThanOrEqual(3);
  const final = await pull(cat, inicial);
  expect(final.changes.marcas_asistencia.created.find(m => m.id === invalida.id)).toMatchObject({ estado: "rechazada" });
  const volumen = enviadoUno.bytesEntrada + enviadoUno.bytesSalida + enviadoDos.bytesEntrada + enviadoDos.bytesSalida + Buffer.byteLength(JSON.stringify(inicial)) + Buffer.byteLength(JSON.stringify(final));
  expect(volumen).toBeLessThan(100 * 1024);
  expect((await administracion.query("SELECT sum(bytes_entrada+bytes_salida)::int AS bytes FROM bitacora_sincronizacion")).rows[0].bytes).toBeGreaterThan(0);
});

test("RF-104 RF-112 RF-307 RF-205: delegación vencida y revocada se evalúan con el mismo JWT; pendientes revocados se rechazan y avisan", async () => {
  await guardarCondicion(segunda.nino.id);
  expect((await condiciones(segunda.nino.id, cat)).estado).toBe(403);
  const id = randomUUID();
  await exigir(manejadoresSeguridad.crearDelegacion, "delegaciones", coord, { id, delegadoId: cat.contexto.cuentaId, desde: new Date(Date.now() - 60000).toISOString(), hasta: new Date(Date.now() + 3600000).toISOString() }, {}, "POST", 201);
  expect((await condiciones(segunda.nino.id, cat)).estado).toBe(200);
  await administracion.query("UPDATE delegacion SET desde=now()-interval '2 hours',hasta=now()-interval '1 hour' WHERE id=$1", [id]);
  expect((await condiciones(segunda.nino.id, cat)).estado).toBe(403);
  const nueva = randomUUID();
  await exigir(manejadoresSeguridad.crearDelegacion, "delegaciones", coord, { id: nueva, delegadoId: cat.contexto.cuentaId, desde: new Date(Date.now() - 60000).toISOString(), hasta: new Date(Date.now() + 3600000).toISOString() }, {}, "POST", 201);
  expect((await condiciones(segunda.nino.id, cat)).estado).toBe(200);
  await exigir(manejadoresSeguridad.revocarDelegacion, "delegaciones/revocar", coord, {}, { id: nueva });
  expect((await condiciones(segunda.nino.id, cat)).estado).toBe(403);
  const pendiente = marca(primera.nino.id);
  await exigir(manejadoresSeguridad.revocarEnlace, "enlaces/revocar", coord, {}, { id: cat.contexto.cuentaId });
  expect(await llamar(sincronizacion.push, "sincronizacion/cambios", cat, { changes: { marcas_asistencia: cambios([pendiente]) } })).toMatchObject({ estado: 401, datos: { codigo: "acceso_denegado" } });
  expect(await llamar(manejarAcceso, "acceso/renovar", undefined, { tokenRenovacion: cat.tokenRenovacion, dispositivoId: cat.dispositivoId, pendientes: 1 })).toMatchObject({ estado: 401, datos: { codigo: "credencial_terminada" } });
  const avisos = await exigir<{ avisos: { cantidad: number; identidadOperativa: string }[] }>(manejadoresSeguridad.avisosCoordinacion, "avisos-coordinacion", coord);
  expect(avisos.avisos).toEqual(expect.arrayContaining([expect.objectContaining({ cantidad: 1, identidadOperativa: "Luz E2E" })]));
  expect((await administracion.query("SELECT id FROM marca_asistencia WHERE id=$1", [pendiente.id])).rowCount).toBe(0);
});

test("RF-102 RF-107 RF-201 RF-205: la inscripción histórica de un ciclo cerrado no autoriza condiciones actuales ni devuelve grupos históricos en contexto", async () => {
  const antiguo = randomUUID(), grupoHistorico = randomUUID(), inscripcionHistorica = randomUUID();
  await administracion.query("INSERT INTO ciclo(id,nombre,inicio,fin,estado,abierto_por,cerrado_en,cerrado_por) VALUES($1,'Histórico','2025-01-01','2025-12-31','cerrado',$2,'2025-12-31',$2)", [antiguo, admin.contexto.cuentaId]);
  await administracion.query("BEGIN; SET LOCAL ROLE sigecat_retencion; SET LOCAL sigecat.contexto='retencion'");
  await administracion.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Antiguo',8,13,'mixto')", [grupoHistorico, antiguo]);
  await administracion.query("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id,desde) VALUES($1,$2,$3,'2025-01-01')", [randomUUID(), grupoHistorico, cat.contexto.cuentaId]);
  await administracion.query("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,9,false,'histórica','2025-01-01')", [inscripcionHistorica, segunda.nino.id, antiguo, segunda.consentimiento!.id]);
  await administracion.query("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,'2025-01-01')", [randomUUID(), inscripcionHistorica, grupoHistorico, coord.contexto.cuentaId]);
  await administracion.query("COMMIT");
  await guardarCondicion(segunda.nino.id);
  const yo = await exigir<ContextoAcceso>(manejadoresSeguridad.yo, "yo", cat); expect(yo.gruposAsignados).toEqual([propio]);
  expect((await condiciones(segunda.nino.id, cat)).estado).toBe(403);
  expect((await perfil(segunda.nino.id, cat)).estado).toBe(403);
  expect((await perfil(primera.nino.id, fam)).estado).toBe(200);
  expect((await llamar(asistencia.domingos, "asistencia/domingos", fam, undefined, { id: segunda.nino.id })).estado).toBe(403);
});

test("RF-106 RF-108 RF-203 RF-307: retiro HTTP ejecuta participantes reales, anonimiza íntegramente y entrega lápidas incluso tras anulación y ante pendientes tardíos", async () => {
  await guardarCondicion();
  const marcaOriginal = marca(primera.nino.id); await pushMarcas([marcaOriginal]);
  await exigir(sincronizacion.push, "sincronizacion/cambios", cat, await lista(cat, propio, [primera.nino.id], "ausente"));
  await corregir(cat);
  const hermano = datosInscripcion(ajeno, "hermano", primera.consentimiento!.apoderadoId); await inscribir(coord, hermano);
  const antes = await pull();
  const asistenciaOriginal = antes.changes.asistencias.created.find(a => a.sesion_id === marcaOriginal.sesion_id)!;
  expect(asistenciaOriginal).toBeDefined();
  await exigir(inscripciones.anular, "inscripciones/anular", coord, { cambioId: randomUUID(), motivo: "Error de inscripción" }, { id: primera.id });
  const retiro = await exigir<{ ejecucionId: string }>(manejadoresSeguridad.retirarConsentimiento, "consentimientos/retirar", fam, {}, { id: primera.consentimiento!.id });
  const ejecucion = (await administracion.query("SELECT completada_en,resumen FROM ejecucion_retencion WHERE id=$1", [retiro.ejecucionId])).rows[0];
  expect(ejecucion.completada_en).not.toBeNull(); expect(Object.keys(ejecucion.resumen).sort()).toEqual(["asistencia", "avisos", "catequizandos", "seguridad"]);
  expect((await administracion.query("SELECT nombres,apellidos,fecha_nacimiento,clave_duplicado,estado FROM catequizando WHERE id=$1", [primera.nino.id])).rows[0]).toEqual({ nombres: "", apellidos: "", fecha_nacimiento: null, clave_duplicado: null, estado: "anonimizado" });
  for (const tabla of ["condicion_catequizando", "cambio_inscripcion", "referencia_duplicado"]) expect((await administracion.query(`SELECT 1 FROM ${tabla} WHERE catequizando_id=$1`, [primera.nino.id])).rowCount).toBe(0);
  expect((await administracion.query("SELECT 1 FROM documento_inscripcion WHERE inscripcion_id=$1", [primera.id])).rowCount).toBe(0);
  expect((await administracion.query("SELECT catequizando_id,codigo_leido,registrado_por,huella_peticion FROM marca_asistencia WHERE id=$1", [marcaOriginal.id])).rows[0]).toMatchObject({ catequizando_id: null, codigo_leido: null, registrado_por: null, huella_peticion: "" });
  expect((await administracion.query("SELECT 1 FROM asistencia WHERE estadistico_id IS NOT NULL AND catequizando_id IS NULL")).rowCount).toBe(2);
  const despues = await pull(cat, antes);
  expect(despues.changes.catequizandos.deleted).toContain(primera.nino.id);
  expect(despues.changes.marcas_asistencia.deleted).toContain(marcaOriginal.id);
  expect(despues.changes.asistencias.deleted).toContain(asistenciaOriginal.id);
  const pendiente = marca(primera.nino.id); expect(await pushMarcas([pendiente])).toMatchObject({ aceptados: 0, rechazados: 1 });
  expect((await administracion.query("SELECT catequizando_id,codigo_leido,estado FROM marca_asistencia WHERE id=$1", [pendiente.id])).rows[0]).toEqual({ catequizando_id: null, codigo_leido: null, estado: "rechazada" });
  expect((await perfil(primera.nino.id, fam)).estado).toBe(403); expect((await perfil(hermano.nino.id, fam)).estado).toBe(200);
  const repetida = await exigir<{ ejecucionId: string }>(manejadoresSeguridad.retirarConsentimiento, "consentimientos/retirar", coord, {}, { id: primera.consentimiento!.id }); expect(repetida).toEqual(retiro);
  expect((await pool.query("SELECT current_user AS rol,current_setting('sigecat.contexto',true) AS contexto")).rows[0]).toMatchObject({ rol: "sigecat_api" });
});

test("RF-106 RF-109: fallo SQL al final del motor real deshace consentimiento, perfiles, asistencia y lápidas en una sola transacción", async () => {
  await guardarCondicion(); const original = marca(primera.nino.id); await pushMarcas([original]);
  await administracion.query(`CREATE FUNCTION impedir_final_retencion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.completada_en IS NOT NULL THEN RAISE EXCEPTION 'fallo controlado E2E'; END IF; RETURN NEW; END $$; CREATE TRIGGER fallo_retencion BEFORE UPDATE ON ejecucion_retencion FOR EACH ROW EXECUTE FUNCTION impedir_final_retencion()`);
  const respuesta = await llamar(manejadoresSeguridad.retirarConsentimiento, "consentimientos/retirar", fam, {}, { id: primera.consentimiento!.id }); expect(respuesta.estado).toBe(500);
  expect((await administracion.query("SELECT retirado_en FROM consentimiento WHERE id=$1", [primera.consentimiento!.id])).rows[0].retirado_en).toBeNull();
  expect((await administracion.query("SELECT estado FROM catequizando WHERE id=$1", [primera.nino.id])).rows[0].estado).toBe("vigente");
  expect((await administracion.query("SELECT codigo_leido FROM marca_asistencia WHERE id=$1", [original.id])).rows[0].codigo_leido).toBe(original.codigo_leido);
  expect((await administracion.query("SELECT 1 FROM ejecucion_retencion")).rowCount).toBe(0); expect((await administracion.query("SELECT 1 FROM lapida_sincronizacion")).rowCount).toBe(0);
  expect((await condiciones(primera.nino.id, cat)).estado).toBe(200);
});

test("RF-108 RF-307: timer real retiene un ciclo vencido, preserva agregados y es idempotente sin permitir escrituras API en ciclo cerrado", async () => {
  const original = marca(primera.nino.id); await pushMarcas([original]);
  await administracion.query("UPDATE ciclo SET estado='cerrado',cerrado_en=now()-interval '3 years',cerrado_por=$2 WHERE id=$1", [cicloId, admin.contexto.cuentaId]);
  await expect(pool.query("UPDATE sesion SET cancelada=true WHERE id=$1", [original.sesion_id])).rejects.toMatchObject({ code: "SG801" });
  const tarde = marca(segunda.nino.id); expect(await pushMarcas([tarde])).toMatchObject({ aceptados: 0, rechazados: 0, descartadosCierre: 1 });
  await retencionDiaria(); await retencionDiaria();
  expect((await administracion.query("SELECT 1 FROM ejecucion_retencion WHERE tipo='vencimiento_ciclo' AND completada_en IS NOT NULL")).rowCount).toBe(1);
  expect((await administracion.query("SELECT 1 FROM asistencia WHERE catequizando_id IS NULL AND estadistico_id IS NOT NULL")).rowCount).toBe(1);
  expect((await administracion.query("SELECT estado FROM catequizando")).rows.every(n => n.estado === "anonimizado")).toBe(true);
  expect((await llamar(manejadoresSeguridad.yo, "yo", fam)).estado).toBe(401);
  expect((await administracion.query("SELECT 1 FROM marca_asistencia WHERE id=$1", [tarde.id])).rowCount).toBe(0);
});

test("RF-201: proveedor de resumen registrado como producción lee las escrituras no confirmadas de la misma Tx con pool 3", async () => {
  const contexto = await cargarContexto({ cuentaId: coord.contexto.cuentaId, credencialId: coord.contexto.credencialId, tipo: "equipo", dispositivoId: coord.dispositivoId });
  expect(contexto).not.toBeNull();
  const clientes: PoolClient[] = [];
  try {
    for (let indice = 0; indice < 3; indice++) clientes.push(await pool.connect());
    const conectar = jest.spyOn(pool, "connect");
    try {
      const perfiles = await Promise.all(clientes.map(async (tx, indice) => {
        await tx.query("BEGIN");
        if (indice === 0) await tx.query("INSERT INTO asistencia(id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,hora_primer_registro,recibido_primer_registro,corregida,conflicto) VALUES($1,$2,$3,$4,'presente','manual',now(),now(),false,false)", [randomUUID(), cicloId, idSesion(cicloId, fecha, "misa"), primera.nino.id]);
        return consultarPerfil(tx, primera.nino.id, contexto!);
      }));
      expect(perfiles[0].resumenes.resumenAsistencia).toMatchObject({ domingos: [{ fecha, misa: "presente", catequesis: "sin_registro" }] });
      expect(perfiles[1].resumenes.resumenAsistencia).toMatchObject({ domingos: [{ fecha, misa: "ausente", catequesis: "sin_registro" }] });
      expect(perfiles[2].resumenes.resumenAsistencia).toEqual(perfiles[1].resumenes.resumenAsistencia);
      expect(conectar).not.toHaveBeenCalled(); expect(pool.waitingCount).toBe(0);
    } finally { conectar.mockRestore(); }
  } finally { for (const tx of clientes) { await tx.query("ROLLBACK"); tx.release(); } }
});

test("RF-102 RF-103 RF-105 RF-313: avisos de producción llegan solo al grupo propio y jornada HTTP cuenta asistencia con identidad operativa", async () => {
  const avisoId = randomUUID();
  await exigir(manejadoresAvisos.publicar, "avisos", coord, { id: avisoId, grupoId: propio, texto: "Aviso de coordinación E2E" }, {}, "POST", 201);
  const propioPull = await pull(), otroPull = await pull(suplente);
  expect(propioPull.changes.avisos_grupo.created).toEqual(expect.arrayContaining([expect.objectContaining({ id: avisoId, autor_visible: "Coordinación E2E" })]));
  expect(otroPull.changes.avisos_grupo.created).toEqual([]);
  await exigir(manejadoresAvisos.retirar, "avisos/retirar", coord, {}, { id: avisoId });
  expect((await pull(cat, propioPull)).changes.avisos_grupo.deleted).toContain(avisoId);
  const actividadId = randomUUID();
  await exigir(manejadoresActividades.crear, "actividades", coord, { id: actividadId, cicloId, nombre: "Jornada E2E", tipo: "jornada", fecha, estado: "vigente" }, {}, "POST", 201);
  const sesion = await exigir<{ sesionId: string }>(asistencia.crearActividad, "asistencia/actividades/sesiones", coord, { actividadId }, {}, "POST", 201);
  expect(await pushMarcas([marca(primera.nino.id, cat, { sesion_id: sesion.sesionId, hora_dispositivo: Date.parse(`${fecha}T12:00:00-05:00`) })])).toMatchObject({ aceptados: 1, rechazados: 0 });
  const cumplimiento = await exigir<{ catequizandoId: string; estado: string; registradores: string[] }[]>(manejadoresActividades.cumplimiento, "actividades/cumplimiento", coord, undefined, { id: actividadId });
  expect(cumplimiento.find(n => n.catequizandoId === primera.nino.id)).toMatchObject({ estado: "cumplida", registradores: ["Luz E2E"] });
  expect(JSON.stringify(cumplimiento)).not.toContain("Nombre reservado");
  const consultar = jest.spyOn(pool, "query");
  try {
    const yo = await exigir<ContextoAcceso>(manejadoresSeguridad.yo, "yo", cat);
    expect(yo.rolesPropios).toEqual(["catequista"]); expect(consultar).toHaveBeenCalledTimes(1);
  } finally { consultar.mockRestore(); }
  await exigir(manejadoresSeguridad.roles, "cuentas/roles", admin, { roles: ["catequista", "familia"] }, { id: cat.contexto.cuentaId }, "PUT");
  await administracion.query("UPDATE apoderado SET cuenta_id=$2 WHERE id=$1", [segunda.consentimiento!.apoderadoId, cat.contexto.cuentaId]);
  expect((await perfil(segunda.nino.id, cat)).estado).toBe(200);
  expect((await condiciones(segunda.nino.id, cat)).estado).toBe(403);
});

test("RF-307 RF-308 RF-312 RNF-304: domingo de 25 niños por HTTP conserva el conteo exacto y push más pull pesa menos de 100 KB", async () => {
  const ids = [primera.nino.id];
  for (let indice = 1; indice < 25; indice++) { const datos = datosInscripcion(propio, `volumen ${indice}`); await inscribir(coord, datos); ids.push(datos.nino.id); }
  await administracion.query("UPDATE inscripcion SET desde='2026-01-01T00:00:00-05:00'; UPDATE asignacion_grupo SET desde='2026-01-01T00:00:00-05:00'");
  const lote = await lista(cat, propio, ids, "presente");
  lote.changes.marcas_asistencia.created.push(...ids.map(id => marca(id)));
  const envio = await llamar<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", cat, lote);
  expect(envio).toMatchObject({ estado: 200, datos: { aceptados: 51, rechazados: 0, descartadosCierre: 0 } });
  await exigir(sincronizacion.push, "sincronizacion/cambios", cat, JSON.parse(JSON.stringify(lote)));
  const descarga = await llamar<RespuestaPull>(sincronizacion.pull, "sincronizacion/cambios?versionEsquema=1", cat);
  expect(descarga.estado).toBe(200); expect(descarga.datos.changes.marcas_asistencia.created).toHaveLength(50); expect(descarga.datos.changes.asistencias.created).toHaveLength(50);
  expect((await administracion.query("SELECT count(*)::int AS cantidad,count(DISTINCT id)::int AS distintos FROM marca_asistencia")).rows[0]).toEqual({ cantidad: 50, distintos: 50 });
  expect((await administracion.query("SELECT count(*)::int AS cantidad FROM asistencia")).rows[0].cantidad).toBe(50);
  const reporte = await exigir(asistencia.reporteMisa, "asistencia/reporte", sup, undefined, { fecha }); expect(reporte).toMatchObject({ totalPresentes: 25, totalActivos: 26, totalManuales: 0 });
  const bytes = envio.bytesEntrada + envio.bytesSalida + descarga.bytesEntrada + descarga.bytesSalida;
  expect(bytes).toBeLessThan(100 * 1024);
  console.info(`E2E RNF-304: 25 niños, 50 marcas, 50 consolidados, push+pull sin comprimir=${bytes} bytes`);
});

test("RF-301 RF-305 RF-308 RF-309 RF-311: ausencia calculada, falta doble, conflicto presente-gana, corrección posterior y cancelación se verifican por HTTP", async () => {
  const consultar = () => exigir<{ domingos: { fecha: string; misa: string; catequesis: string }[]; faltas: number }>(asistencia.domingos, "asistencia/domingos", fam, undefined, { id: primera.nino.id });
  expect(await consultar()).toMatchObject({ domingos: [{ fecha, misa: "ausente", catequesis: "sin_registro" }], faltas: 0 });
  await exigir(sincronizacion.push, "sincronizacion/cambios", cat, await lista(cat, propio, [primera.nino.id], "ausente"));
  expect(await consultar()).toMatchObject({ domingos: [{ fecha, misa: "ausente", catequesis: "ausente" }], faltas: 1 });
  await exigir(sincronizacion.push, "sincronizacion/cambios", suplente, await lista(suplente, propio, [primera.nino.id], "presente"));
  expect(await consultar()).toMatchObject({ domingos: [{ fecha, misa: "ausente", catequesis: "presente" }], faltas: 0 });
  expect((await administracion.query("SELECT valor,conflicto FROM asistencia WHERE catequizando_id=$1", [primera.nino.id])).rows[0]).toEqual({ valor: "presente", conflicto: true });
  expect((await exigir<{ tipo: string }[]>(asistencia.listarAvisos, "asistencia/avisos", coord)).map(a => a.tipo)).toContain("conflicto_registro");
  const correccion = { id: randomUUID(), ciclo_id: cicloId, sesion_id: idSesion(cicloId, fecha, "catequesis"), catequizando_id: primera.nino.id, valor_anterior: "presente", valor_nuevo: "ausente", corregido_por: coord.contexto.cuentaId, cuenta_id: coord.contexto.cuentaId, credencial_id: coord.contexto.credencialId, dispositivo_id: coord.dispositivoId, hora_dispositivo: Date.parse("2026-01-05T00:00:00-05:00"), desfase_reloj_ms: 0 };
  expect(await exigir<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", coord, { changes: { correcciones_asistencia: cambios([correccion]) } })).toMatchObject({ rechazados: 1, aceptados: 0 });
  const autorizada = { ...correccion, id: randomUUID(), motivo: "Revisión posterior al domingo" };
  expect(await exigir<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", coord, { changes: { correcciones_asistencia: cambios([autorizada]) } })).toMatchObject({ aceptados: 1, rechazados: 0 });
  expect(await consultar()).toMatchObject({ faltas: 1 });
  const sesion = { id: idSesion(cicloId, fecha, "misa"), ciclo_id: cicloId, fecha, tipo: "misa", cancelada: true, motivo_cancelacion: "Domingo sin misa", actualizado_por: coord.contexto.cuentaId, cuenta_id: coord.contexto.cuentaId, credencial_id: coord.contexto.credencialId, dispositivo_id: coord.dispositivoId };
  expect(await exigir<ResumenPush>(sincronizacion.push, "sincronizacion/cambios", coord, { changes: { sesiones: { created: [], updated: [sesion], deleted: [] } } })).toMatchObject({ aceptados: 1, rechazados: 0 });
  expect(await consultar()).toMatchObject({ domingos: [{ fecha, misa: "no_aplica", catequesis: "ausente" }], faltas: 0 });
});
