import { randomBytes, randomUUID } from "node:crypto";
import { HttpRequest, InvocationContext, type HttpResponseInit } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import type { Pool } from "pg";
import { expandirLote } from "@/lib/justificaciones/lote";
import type { Causa } from "@/lib/justificaciones/tipos";
import { hoyEnLima } from "@/lib/seguridad/fechas";
import { nombreBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { configurarAlmacenEvidencias } from "../../../src/modulos/justificaciones/infraestructura/almacen";
import { crearAlmacenEvidencias } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";
import { repositorioEvidenciasPg } from "../../../src/modulos/justificaciones/infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg as repo } from "../../../src/modulos/justificaciones/infraestructura/repositorio-justificaciones-pg";
import { manejadoresCoordinacion as coord, manejadoresJustificaciones as familiaHttp } from "../../../src/modulos/justificaciones/http";
import { firmarJwt } from "../../../src/modulos/seguridad/infraestructura/firmador-jwt";
import { enTx, prepararBd, type BdPrueba } from "./soporte";

let bd: BdPrueba;
let pool: Pool;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (texto: string, valores: unknown[]) => pool.query(texto, valores) }));

const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
const contenedor = BlobServiceClient.fromConnectionString(conexion).getContainerClient(`evidencias-${randomUUID()}`);
const claveAnterior = process.env.JWT_CLAVE;
const invocacion = new InvocationContext({ functionName: "coordinacionPrueba" });
const hoy = hoyEnLima(new Date());
const dia = (d: number) => { const f = new Date(`${hoy}T12:00:00Z`); f.setUTCDate(f.getUTCDate() + d); return f.toISOString().slice(0, 10); };
const cicloId = randomUUID(), grupoA = randomUUID(), grupoB = randomUUID();
const sesiones = { s2: randomUUID(), s3: randomUUID(), s4: randomUUID(), s5: randomUUID(), s6: randomUUID(), vencida: randomUUID() };
const fechaDe: Record<keyof typeof sesiones, number> = { s2: -2, s3: -3, s4: -4, s5: -5, s6: -6, vencida: -20 };
type Actor = { cuentaId: string; jwt: string };
const actores = {} as Record<"coordinador" | "catequistaA" | "catequistaB" | "supervision" | "delegado" | "familia", Actor>;
let apoderadoId: string, otroApoderado: string, hijos: string[];

const q = (texto: string, valores: unknown[] = []) => bd.admin.query(texto, valores);
async function crearEquipo(nombre: string, roles: string[], grupo?: string): Promise<Actor> {
  const cuentaId = randomUUID(), credencialId = randomUUID(), dispositivoId = randomUUID();
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,$2,false)", [cuentaId, nombre]);
  for (const rol of roles) await q("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,$2)", [cuentaId, rol]);
  await q("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado,dispositivo_id) VALUES($1,$2,'equipo',$3,'activa',$4)", [credencialId, cuentaId, randomBytes(32), dispositivoId]);
  if (grupo) await q("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id,desde) VALUES($1,$2,$3,$4)", [randomUUID(), grupo, cuentaId, `${dia(-90)}T05:00:00Z`]);
  return { cuentaId, jwt: await firmarJwt({ cuentaId, credencialId, tipo: "equipo", dispositivoId }) };
}
async function crearNino(nombres: string, apoderado: string, grupo: string): Promise<string> {
  const id = randomUUID(), consentimiento = randomUUID(), inscripcion = randomUUID(), desde = `${dia(-90)}T05:00:00Z`;
  await q("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,$2,'Prueba','2016-01-01','femenino',true,$3)", [id, nombres, actores.coordinador.cuentaId]);
  await q("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, id, apoderado, actores.coordinador.cuentaId]);
  await q("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,10,false,'prueba',$5)", [inscripcion, id, cicloId, consentimiento, desde]);
  await q("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,$5)", [randomUUID(), inscripcion, grupo, actores.coordinador.cuentaId, desde]);
  await q("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'madre')", [randomUUID(), id, apoderado]);
  return id;
}

beforeAll(async () => {
  process.env.JWT_CLAVE = "clave-de-prueba-004-coordinacion-sin-uso-32b";
  bd = await prepararBd("coord004");
  pool = bd.app;
  await contenedor.create();
  configurarAlmacenEvidencias(crearAlmacenEvidencias({ modo: "pruebas", conexion, contenedor: contenedor.containerName }));
  actores.coordinador = await crearEquipo("Coordinación 004", ["coordinacion"]);
  await q("INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,'Ciclo 004',$2,$3,$4)", [cicloId, dia(-90), dia(90), actores.coordinador.cuentaId]);
  await q("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$3,'Grupo A',8,13,'mixto'),($2,$3,'Grupo B',8,13,'mixto')", [grupoA, grupoB, cicloId]);
  for (const [clave, d] of Object.entries(fechaDe)) await q("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,$3,'misa')", [sesiones[clave as keyof typeof sesiones], cicloId, dia(d)]);
  actores.catequistaA = await crearEquipo("Catequista A", ["catequista"], grupoA);
  actores.catequistaB = await crearEquipo("Catequista B", ["catequista"], grupoB);
  actores.supervision = await crearEquipo("Párroco", ["supervision"]);
  actores.delegado = await crearEquipo("Delegado", ["catequista"], grupoA);
  await q("INSERT INTO delegacion(id,delegante_id,delegado_id,desde,hasta) VALUES($1,$2,$3,now()-interval '1 day',now()+interval '7 days')", [randomUUID(), actores.coordinador.cuentaId, actores.delegado.cuentaId]);
  const familiaCuenta = randomUUID(), familiaCredencial = randomUUID();
  apoderadoId = randomUUID(); otroApoderado = randomUUID();
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Familia 004',false)", [familiaCuenta]);
  await q("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'familia')", [familiaCuenta]);
  await q("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'familia',$3,'activa')", [familiaCredencial, familiaCuenta, randomBytes(32)]);
  await q("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto,cuenta_id) VALUES($1,'Rosa','Quispe','otro','prueba',$2),($3,'Pedro','Ajeno','otro','prueba',NULL)", [apoderadoId, familiaCuenta, otroApoderado]);
  hijos = [await crearNino("Ana", apoderadoId, grupoA), await crearNino("Luis", apoderadoId, grupoA)];
  await crearNino("Eva", otroApoderado, grupoB);
  actores.familia = { cuentaId: familiaCuenta, jwt: await firmarJwt({ cuentaId: familiaCuenta, credencialId: familiaCredencial, tipo: "familia" }) };
}, 120000);
afterAll(async () => {
  configurarAlmacenEvidencias(undefined);
  await contenedor.deleteIfExists();
  await bd?.cerrar();
  if (claveAnterior === undefined) delete process.env.JWT_CLAVE; else process.env.JWT_CLAVE = claveAnterior;
});

function peticion(metodo: string, ruta: string, actor?: Actor, cuerpo?: unknown, params: Record<string, string> = {}): HttpRequest {
  return new HttpRequest({ method: metodo, url: `http://localhost/api/${ruta}`, headers: { ...(actor ? { Authorization: `Bearer ${actor.jwt}` } : {}), "content-type": "application/json" }, params, ...(cuerpo === undefined ? {} : { body: { string: JSON.stringify(cuerpo) } }) });
}
type Cuerpo = Record<string, unknown> & { codigo?: string };
const cuerpo = (r: HttpResponseInit) => r.jsonBody as Cuerpo;
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5000, 3)]);

/** Lote ya enviado con su evidencia confirmada y la foto en Azurite. */
async function loteGuardado(ausencias: { catequizandoId: string; sesion: keyof typeof sesiones }[], apoderado = apoderadoId, causa: Causa = "salud_nino") {
  const evidenciaId = randomUUID(), blobNombre = nombreBlob(cicloId, evidenciaId, 1);
  await contenedor.getBlockBlobClient(blobNombre).uploadData(jpeg(), { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
  const js = expandirLote({
    loteId: randomUUID(), cicloId, causa, evidenciaId, cantidadFotos: 1, apoderadoId: apoderado, canal: "enlace",
    ausencias: ausencias.map(a => ({ catequizandoId: a.catequizandoId, sesionId: sesiones[a.sesion], tipoSesion: "misa", fecha: dia(fechaDe[a.sesion]), justificacionId: randomUUID(), anticipada: false })),
  }, new Date().toISOString());
  await enTx(bd, async tx => {
    await repositorioEvidenciasPg.reservar(tx, { id: evidenciaId, cicloId, subidaPor: actores.coordinador.cuentaId, en: new Date() });
    await repositorioEvidenciasPg.confirmar(tx, evidenciaId, [{ orden: 1, blobNombre, bytes: jpeg().length, contentType: "image/jpeg" }], new Date());
    await repo.insertarLote(tx, js, actores.coordinador.cuentaId);
  });
  return { evidenciaId, js };
}
const bandeja = async (actor: Actor) => coord.bandeja(peticion("GET", "justificaciones/bandeja", actor), invocacion);
const revisar = (actor: Actor, ids: string[], decision: "aprobada" | "rechazada", motivo?: string) =>
  coord.revisar(peticion("POST", "justificaciones/revisiones", actor, { ids, decision, ...(motivo === undefined ? {} : { motivo }) }), invocacion);
type Lote = { loteId: string; justificaciones: { id: string; duplicada: boolean; nombre: string }[] };

describe("plazo de justificación", () => {
  const ruta = `ciclos/${cicloId}/plazo-justificacion`;
  const poner = (actor: Actor, diasPlazo: unknown) => coord.definirPlazo(peticion("PUT", ruta, actor, { diasPlazo }, { id: cicloId }), invocacion);

  test("RF-405: GET devuelve 7 si no se definió", async () => {
    const r = await coord.obtenerPlazo(peticion("GET", ruta, actores.catequistaA, undefined, { id: cicloId }), invocacion);
    expect(r.status).toBe(200);
    expect(cuerpo(r)).toMatchObject({ diasPlazo: 7, predeterminado: true });
  });

  test("RF-405: la coordinación define el plazo y el cambio queda auditado", async () => {
    const r = await poner(actores.coordinador, 10);
    expect(r.status).toBe(200);
    expect(cuerpo(r)).toMatchObject({ diasPlazo: 10, predeterminado: false, definidoPor: actores.coordinador.cuentaId });
    const auditoria = await q("SELECT resultado,detalle FROM evento_auditoria WHERE accion='justificacion:configurar-plazo' AND recurso_id=$1", [cicloId]);
    expect(auditoria.rows).toEqual([{ resultado: "permitido", detalle: { cantidad: 10 } }]);
    expect((await poner(actores.coordinador, 7)).status).toBe(200);
  });

  test("RF-405: un catequista recibe 403 al definir el plazo", async () => {
    expect((await poner(actores.catequistaA, 9)).status).toBe(403);
  });

  test("RF-405: un plazo fuera de 1 a 60 responde 400", async () => {
    for (const dias of [0, 61, 2.5]) {
      const r = await poner(actores.coordinador, dias);
      expect(r.status).toBe(400);
      expect(cuerpo(r).codigo).toBe("plazo_invalido");
    }
  });
});

describe("bandeja y revisión", () => {
  let lote: Awaited<ReturnType<typeof loteGuardado>>;
  let duplicado: Awaited<ReturnType<typeof loteGuardado>>;
  beforeAll(async () => {
    lote = await loteGuardado([{ catequizandoId: hijos[0], sesion: "s2" }, { catequizandoId: hijos[1], sesion: "s2" }]);
    duplicado = await loteGuardado([{ catequizandoId: hijos[0], sesion: "s2" }], otroApoderado);
  });

  test("RF-408: reúne las pendientes del ciclo agrupadas por lote", async () => {
    const r = await bandeja(actores.coordinador);
    expect(r.status).toBe(200);
    const lotes = cuerpo(r).lotes as Lote[];
    const propio = lotes.find(l => l.loteId === lote.js[0].loteId);
    expect(propio?.justificaciones.map(j => j.id).sort()).toEqual(lote.js.map(j => j.id).sort());
    expect(propio?.justificaciones.map(j => j.nombre).sort()).toEqual(["Ana Prueba", "Luis Prueba"]);
  });

  test("RF-408: ambas quedan registradas y la bandeja marca el duplicado", async () => {
    const lotes = cuerpo(await bandeja(actores.coordinador)).lotes as Lote[];
    const marcas = new Map(lotes.flatMap(l => l.justificaciones).map(j => [j.id, j.duplicada]));
    expect(marcas.get(lote.js[0].id)).toBe(true);
    expect(marcas.get(duplicado.js[0].id)).toBe(true);
    expect(marcas.get(lote.js[1].id)).toBe(false);
  });

  test("RF-408: un catequista recibe 403 en la bandeja", async () => {
    expect((await bandeja(actores.catequistaA)).status).toBe(403);
  });

  test("RF-408: supervisión ve la bandeja en solo lectura", async () => {
    expect((await bandeja(actores.supervision)).status).toBe(200);
    expect((await revisar(actores.supervision, [lote.js[0].id], "aprobada")).status).toBe(403);
  });

  test("RF-408: un catequista recibe 403 al aprobar", async () => {
    expect((await revisar(actores.catequistaA, [lote.js[0].id], "aprobada")).status).toBe(403);
  });

  test("RF-408: supervisión no puede revisar", async () => {
    expect((await revisar(actores.supervision, [lote.js[1].id], "rechazada", "No corresponde")).status).toBe(403);
    expect((await enTx(bd, tx => repo.obtener(tx, lote.js[1].id)))?.estadoRevision).toBe("pendiente");
  });

  test("RF-408: rechazar sin motivo responde 400", async () => {
    const r = await revisar(actores.coordinador, [duplicado.js[0].id], "rechazada");
    expect(r.status).toBe(400);
    expect(cuerpo(r).codigo).toBe("motivo_requerido");
  });

  test("RF-403: aprueba las justificaciones de un lote juntas o por separado", async () => {
    const separada = await revisar(actores.coordinador, [lote.js[0].id], "aprobada");
    expect(separada.status).toBe(200);
    expect(cuerpo(separada).revisadas).toEqual([{ id: lote.js[0].id, estado: "aprobada" }]);
    expect((await enTx(bd, tx => repo.obtener(tx, lote.js[1].id)))?.estadoRevision).toBe("pendiente");
    const otro = await loteGuardado([{ catequizandoId: hijos[0], sesion: "s3" }, { catequizandoId: hijos[1], sesion: "s3" }]);
    const juntas = await revisar(actores.coordinador, otro.js.map(j => j.id), "rechazada", "Fecha del certificado distinta");
    expect(cuerpo(juntas).revisadas).toEqual(otro.js.map(j => ({ id: j.id, estado: "rechazada" })));
    expect((await revisar(actores.coordinador, [lote.js[0].id], "aprobada")).status).toBe(409);
  });

  test("RF-408: un delegado vigente puede aprobar", async () => {
    const r = await revisar(actores.delegado, [lote.js[1].id], "aprobada");
    expect(r.status).toBe(200);
    expect((await enTx(bd, tx => repo.obtener(tx, lote.js[1].id)))).toMatchObject({ estadoRevision: "aprobada", revisadaPor: actores.delegado.cuentaId });
  });
});

describe("evidencia e historial", () => {
  let lote: Awaited<ReturnType<typeof loteGuardado>>;
  beforeAll(async () => { lote = await loteGuardado([{ catequizandoId: hijos[0], sesion: "s4" }]); });
  const evidencia = (actor: Actor, id = lote.js[0].id) => coord.evidencia(peticion("GET", `justificaciones/${id}/evidencia`, actor, undefined, { id }), invocacion);
  const historial = (actor: Actor, id = hijos[0]) => coord.historial(peticion("GET", `catequizandos/${id}/justificaciones`, actor, undefined, { id }), invocacion);

  test("RF-410: un catequista de otro grupo recibe 403 al ver estado y evidencia", async () => {
    expect((await evidencia(actores.catequistaB)).status).toBe(403);
    expect((await historial(actores.catequistaB)).status).toBe(403);
    expect((await evidencia(actores.catequistaA)).status).toBe(200);
    expect((await evidencia(actores.supervision)).status).toBe(200);
  });

  test("RF-410: la familia recibe 403", async () => {
    expect((await evidencia(actores.familia)).status).toBe(403);
  });

  test("RNF-403: cada consulta queda en la auditoría", async () => {
    const antes = Number((await q("SELECT count(*) AS n FROM evento_auditoria WHERE accion='evidencia:leer' AND recurso_id=$1 AND resultado='permitido'", [lote.js[0].id])).rows[0].n);
    await evidencia(actores.coordinador);
    await evidencia(actores.coordinador);
    const despues = (await q("SELECT count(*) AS n,max(cuenta_id::text) AS cuenta FROM evento_auditoria WHERE accion='evidencia:leer' AND recurso_id=$1 AND resultado='permitido'", [lote.js[0].id])).rows[0];
    expect(Number(despues.n)).toBe(antes + 2);
  });

  test("RNF-403: la respuesta lleva Cache-Control no-store", async () => {
    const r = await evidencia(actores.coordinador);
    expect(r.headers).toMatchObject({ "Cache-Control": "no-store" });
    const [{ url }] = cuerpo(r).archivos as { url: string }[];
    expect(new URL(url).searchParams.get("sp")).toBe("r");
    expect(new URL(url).searchParams.get("rscc")).toBe("no-store");
    const descarga = await fetch(url);
    expect(descarga.status).toBe(200);
    expect(descarga.headers.get("cache-control")).toBe("no-store");
  });

  test("RF-407: una evidencia eliminada responde 410 «sin evidencia»", async () => {
    const otro = await loteGuardado([{ catequizandoId: hijos[1], sesion: "s4" }]);
    await q("SELECT marcar_evidencia_eliminada($1,'consentimiento')", [otro.evidenciaId]);
    const r = await evidencia(actores.coordinador, otro.js[0].id);
    expect(r.status).toBe(410);
    expect(cuerpo(r).codigo).toBe("sin_evidencia");
  });

  test("RF-407: el perfil lista la ausencia, la causa, la fecha de envío, quién la envió y el canal", async () => {
    const r = await historial(actores.catequistaA);
    expect(r.status).toBe(200);
    const fila = (cuerpo(r).justificaciones as Record<string, unknown>[]).find(j => j.id === lote.js[0].id);
    expect(fila).toMatchObject({ sesionId: sesiones.s4, fecha: dia(-4), tipoSesion: "misa", causa: "salud_nino", canal: "enlace", enviadaEn: expect.any(String), enviadaPor: { apoderadoId, nombre: "Rosa Quispe" }, registradaPor: null });
  });

  test("RF-410: un catequista de otro grupo recibe 403", async () => {
    expect((await historial(actores.catequistaB)).status).toBe(403);
  });
});

describe("registro en nombre de un apoderado", () => {
  const justificables = (actor: Actor, id = hijos[1]) => coord.justificablesDeNino(peticion("GET", `coordinacion/catequizandos/${id}/ausencias-justificables`, actor, undefined, { id }), invocacion);
  async function evidenciaSubida(actor: Actor): Promise<string> {
    const evidenciaId = randomUUID();
    const reserva = await familiaHttp.reservarEvidencia(peticion("POST", "evidencias/reservas", actor, { evidenciaId, archivos: [{ orden: 1, bytes: jpeg().length, contentType: "image/jpeg" }] }), invocacion);
    expect(reserva.status).toBe(201);
    const [{ url }] = cuerpo(reserva).archivos as { url: string }[];
    expect((await fetch(url, { method: "PUT", body: new Uint8Array(jpeg()), headers: { "x-ms-blob-type": "BlockBlob", "content-type": "image/jpeg" } })).status).toBe(201);
    return evidenciaId;
  }
  const lote = (evidenciaId: string, apoderado: string, sesionId: string, catequizandoId = hijos[1]) => ({
    loteId: randomUUID(), evidenciaId, causa: "familiar_directo", apoderadoId: apoderado, ausencias: [{ justificacionId: randomUUID(), catequizandoId, sesionId, anticipada: false }],
  });

  test("RF-406: registrada por la coordinación en nombre de, con quién y cuándo", async () => {
    const r = await justificables(actores.coordinador);
    expect(r.status).toBe(200);
    const datos = cuerpo(r) as { apoderados: { apoderadoId: string; nombre: string }[]; ausencias: { sesionId: string }[] };
    expect(datos.apoderados).toEqual([{ apoderadoId, nombre: "Rosa Quispe", relacion: "madre" }]);
    expect(datos.ausencias.map(a => a.sesionId)).toContain(sesiones.s5);
    const peticionLote = lote(await evidenciaSubida(actores.coordinador), apoderadoId, sesiones.s5);
    const creado = await familiaHttp.crearLote(peticion("POST", "justificaciones/lotes", actores.coordinador, peticionLote), invocacion);
    expect(creado.status).toBe(201);
    const guardada = await enTx(bd, tx => repo.obtener(tx, peticionLote.ausencias[0].justificacionId));
    expect(guardada).toMatchObject({ canal: "coordinacion", enviadaPor: apoderadoId, registradaPor: actores.coordinador.cuentaId, registradaEn: expect.any(String) });
    const perfil = cuerpo(await coord.historial(peticion("GET", `catequizandos/${hijos[1]}/justificaciones`, actores.coordinador, undefined, { id: hijos[1] }), invocacion));
    expect((perfil.justificaciones as Record<string, unknown>[]).find(j => j.id === guardada?.id)).toMatchObject({ canal: "coordinacion", registradaPor: "Coordinación 004", registradaEn: guardada?.registradaEn, enviadaPor: { apoderadoId, nombre: "Rosa Quispe" } });
  });

  test("RF-406: muestra «registrada por la coordinación en nombre de» con quién y cuándo", async () => {
    const perfil = cuerpo(await coord.historial(peticion("GET", `catequizandos/${hijos[1]}/justificaciones`, actores.catequistaA, undefined, { id: hijos[1] }), invocacion));
    const registradas = (perfil.justificaciones as { canal: string; registradaPor: string | null; registradaEn: string | null }[]).filter(j => j.canal === "coordinacion");
    expect(registradas).toEqual([expect.objectContaining({ registradaPor: "Coordinación 004", registradaEn: expect.any(String) })]);
  });

  test("RF-406: un apoderadoId que no es apoderado del niño responde 400", async () => {
    const r = await familiaHttp.crearLote(peticion("POST", "justificaciones/lotes", actores.coordinador, lote(await evidenciaSubida(actores.coordinador), otroApoderado, sesiones.s6)), invocacion);
    expect(r.status).toBe(400);
    expect(cuerpo(r).codigo).toBe("apoderado_ajeno");
  });

  test("RF-406: una ausencia vencida no se puede registrar", async () => {
    const r = await familiaHttp.crearLote(peticion("POST", "justificaciones/lotes", actores.coordinador, lote(await evidenciaSubida(actores.coordinador), apoderadoId, sesiones.vencida)), invocacion);
    expect(r.status).toBe(400);
    expect(cuerpo(r).codigo).toBe("no_justificable");
  });

  test("RF-406: un catequista recibe 403", async () => {
    expect((await justificables(actores.catequistaA)).status).toBe(403);
    const r = await familiaHttp.crearLote(peticion("POST", "justificaciones/lotes", actores.catequistaA, lote(randomUUID(), apoderadoId, sesiones.s6)), invocacion);
    expect(r.status).toBe(403);
  });

  test("RF-406: la familia no puede registrar en nombre de otro apoderado", async () => {
    const r = await familiaHttp.crearLote(peticion("POST", "justificaciones/lotes", actores.familia, lote(randomUUID(), otroApoderado, sesiones.s6, hijos[0])), invocacion);
    expect(r.status).toBe(403);
  });
});
