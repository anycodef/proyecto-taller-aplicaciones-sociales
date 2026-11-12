import { randomBytes, randomUUID } from "node:crypto";
import { HttpRequest, InvocationContext, type HttpResponseInit } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import type { Pool } from "pg";
import { expandirLote } from "@/lib/justificaciones/lote";
import { revisar } from "@/lib/justificaciones/estados";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { hoyEnLima } from "@/lib/seguridad/fechas";
import { crearLote, type EntradaLoteHttp } from "../../../src/modulos/justificaciones/aplicacion/crear-lote";
import type { AlmacenEvidencias, InspeccionBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { nombreBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { configurarAlmacenEvidencias } from "../../../src/modulos/justificaciones/infraestructura/almacen";
import { crearAlmacenEvidencias, VIGENCIA_SAS_MS } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";
import { repositorioEvidenciasPg } from "../../../src/modulos/justificaciones/infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg as repo } from "../../../src/modulos/justificaciones/infraestructura/repositorio-justificaciones-pg";
import { manejadoresJustificaciones as http } from "../../../src/modulos/justificaciones/http";
import { limitarPorCuenta } from "../../../src/compartido/http/limites";
import { cargarContexto } from "../../../src/modulos/seguridad/aplicacion/contexto";
import { firmarJwt } from "../../../src/modulos/seguridad/infraestructura/firmador-jwt";
import { enTx, prepararBd, type BdPrueba } from "./soporte";

let bd: BdPrueba;
let pool: Pool;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (texto: string, valores: unknown[]) => pool.query(texto, valores) }));

const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
const contenedor = BlobServiceClient.fromConnectionString(conexion).getContainerClient(`evidencias-${randomUUID()}`);
const claveAnterior = process.env.JWT_CLAVE;
const invocacion = new InvocationContext({ functionName: "justificacionesPrueba" });

const hoy = hoyEnLima(new Date());
const dia = (desplazamiento: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + desplazamiento); return d.toISOString().slice(0, 10); };
const cicloId = randomUUID(), grupoId = randomUUID(), coordinadorId = randomUUID();
const sesiones = { reciente: randomUUID(), ajena: randomUUID(), servicio: randomUUID(), servicio2: randomUUID(), vencida: randomUUID(), futura: randomUUID() };
type Familia = { cuentaId: string; credencialId: string; apoderadoId: string; hijos: string[]; jwt: string };
let familia: Familia, otraFamilia: Familia;
let jwtCatequista: string;

const q = (texto: string, valores: unknown[] = []) => bd.admin.query(texto, valores);
async function crearNino(nombres: string, apoderadoId: string): Promise<string> {
  const id = randomUUID(), consentimiento = randomUUID(), inscripcion = randomUUID(), desde = `${dia(-90)}T05:00:00Z`;
  await q("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,$2,'Prueba','2016-01-01','femenino',true,$3)", [id, nombres, coordinadorId]);
  await q("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, id, apoderadoId, coordinadorId]);
  await q("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,10,false,'prueba',$5)", [inscripcion, id, cicloId, consentimiento, desde]);
  await q("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,$5)", [randomUUID(), inscripcion, grupoId, coordinadorId, desde]);
  await q("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'madre')", [randomUUID(), id, apoderadoId]);
  return id;
}
async function crearFamilia(nombres: string[]): Promise<Familia> {
  const cuentaId = randomUUID(), credencialId = randomUUID(), apoderadoId = randomUUID();
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,$2,false)", [cuentaId, `Familia ${nombres.join(" y ")}`]);
  await q("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'familia')", [cuentaId]);
  await q("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'familia',$3,'activa')", [credencialId, cuentaId, randomBytes(32)]);
  await q("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto,cuenta_id) VALUES($1,'Rosa','Apoderada','otro','prueba',$2)", [apoderadoId, cuentaId]);
  const hijos: string[] = [];
  for (const nombre of nombres) hijos.push(await crearNino(nombre, apoderadoId));
  return { cuentaId, credencialId, apoderadoId, hijos, jwt: await firmarJwt({ cuentaId, credencialId, tipo: "familia" }) };
}

beforeAll(async () => {
  process.env.JWT_CLAVE = "clave-de-prueba-004-sin-uso-en-produccion-32b";
  bd = await prepararBd("http004");
  pool = bd.app;
  await contenedor.create();
  configurarAlmacenEvidencias(crearAlmacenEvidencias({ modo: "pruebas", conexion, contenedor: contenedor.containerName }));
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Coordinación',false)", [coordinadorId]);
  await q("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'coordinacion')", [coordinadorId]);
  await q("INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,'Ciclo 004',$2,$3,$4)", [cicloId, dia(-90), dia(90), coordinadorId]);
  await q("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Grupo A',8,13,'mixto')", [grupoId, cicloId]);
  const fechas: Record<keyof typeof sesiones, number> = { reciente: -2, ajena: -3, servicio: -4, servicio2: -5, vencida: -20, futura: 7 };
  for (const [clave, desplazamiento] of Object.entries(fechas)) await q("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,$3,'misa')", [sesiones[clave as keyof typeof sesiones], cicloId, dia(desplazamiento)]);
  familia = await crearFamilia(["Ana", "Luis"]);
  otraFamilia = await crearFamilia(["Eva"]);
  const catequista = randomUUID(), credencial = randomUUID(), dispositivo = randomUUID();
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Catequista 1',true)", [catequista]);
  await q("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'catequista')", [catequista]);
  await q("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado,dispositivo_id) VALUES($1,$2,'equipo',$3,'activa',$4)", [credencial, catequista, randomBytes(32), dispositivo]);
  await q("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id,desde) VALUES($1,$2,$3,$4)", [randomUUID(), grupoId, catequista, `${dia(-90)}T05:00:00Z`]);
  jwtCatequista = await firmarJwt({ cuentaId: catequista, credencialId: credencial, tipo: "equipo", dispositivoId: dispositivo });
}, 120000);
afterAll(async () => {
  configurarAlmacenEvidencias(undefined);
  await contenedor.deleteIfExists();
  await bd?.cerrar();
  if (claveAnterior === undefined) delete process.env.JWT_CLAVE; else process.env.JWT_CLAVE = claveAnterior;
});

function peticion(metodo: "GET" | "POST", ruta: string, jwt?: string, cuerpo?: unknown): HttpRequest {
  return new HttpRequest({ method: metodo, url: `http://localhost/api/${ruta}`, headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), "content-type": "application/json" }, ...(cuerpo === undefined ? {} : { body: { string: JSON.stringify(cuerpo) } }) });
}
type Cuerpo = Record<string, unknown> & { codigo?: string };
const cuerpo = (r: HttpResponseInit) => r.jsonBody as Cuerpo;
const jpeg = (bytes: number): Uint8Array<ArrayBuffer> => new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(Math.max(0, bytes - 4), 7)]));
const subir = (url: string, datos: Uint8Array<ArrayBuffer>) => fetch(url, { method: "PUT", body: datos, headers: { "x-ms-blob-type": "BlockBlob", "content-type": "image/jpeg" } });
const archivo = (orden: number, bytes = 120_000) => ({ orden, bytes, contentType: "image/jpeg" });

/** Reserva por HTTP y sube la foto con la SAS, como hará el cliente. */
async function evidenciaSubida(jwt: string, bytes = 120_000): Promise<string> {
  const evidenciaId = randomUUID();
  const reserva = await http.reservarEvidencia(peticion("POST", "evidencias/reservas", jwt, { evidenciaId, archivos: [archivo(1, bytes)] }), invocacion);
  expect(reserva.status).toBe(201);
  const [{ url }] = cuerpo(reserva).archivos as { url: string }[];
  expect((await subir(url, jpeg(bytes))).status).toBe(201);
  return evidenciaId;
}
const item = (catequizandoId: string, sesionId: string, anticipada = false) => ({ justificacionId: randomUUID(), catequizandoId, sesionId, anticipada });

describe("GET /familia/ausencias-justificables", () => {
  test("RF-401: devuelve las ausencias justificables de los hijos con niño, fecha y sesión", async () => {
    const r = await http.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables", familia.jwt), invocacion);
    expect(r.status).toBe(200);
    const datos = cuerpo(r) as { diasPlazo: number; ninos: { nombres: string }[]; ausencias: { catequizandoId: string; sesionId: string; tipoSesion: string; fecha: string; venceEn: string }[] };
    expect(datos.diasPlazo).toBe(7);
    expect(datos.ninos.map(n => n.nombres)).toEqual(["Ana", "Luis"]);
    for (const hijo of familia.hijos) {
      expect(datos.ausencias).toContainEqual({ catequizandoId: hijo, sesionId: sesiones.reciente, tipoSesion: "misa", fecha: dia(-2), venceEn: `${dia(5)}T23:59:59-05:00` });
    }
    expect(datos.ausencias.every(a => familia.hijos.includes(a.catequizandoId))).toBe(true);
  });

  test("RF-405: una ausencia vencida no aparece como justificable", async () => {
    const datos = cuerpo(await http.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables", familia.jwt), invocacion)) as { ausencias: { sesionId: string }[] };
    expect(datos.ausencias.some(a => a.sesionId === sesiones.vencida)).toBe(false);
    expect(datos.ausencias.some(a => a.sesionId === sesiones.futura)).toBe(false);
  });

  test("RF-401: sin token responde 401", async () => {
    expect((await http.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables"), invocacion)).status).toBe(401);
  });

  test("RF-401: un catequista recibe 403", async () => {
    expect((await http.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables", jwtCatequista), invocacion)).status).toBe(403);
  });
});

describe("GET /familia/sesiones-anticipables", () => {
  test("RF-404: devuelve las sesiones futuras de los hijos que no tienen justificación", async () => {
    const r = await http.sesionesAnticipables(peticion("GET", "familia/sesiones-anticipables", familia.jwt), invocacion);
    expect(r.status).toBe(200);
    const datos = cuerpo(r) as { sesiones: { catequizandoId: string; sesionId: string; fecha: string }[] };
    expect(datos.sesiones).toEqual([...familia.hijos].sort().map(catequizandoId => ({ catequizandoId, sesionId: sesiones.futura, tipoSesion: "misa", fecha: dia(7) })));
  });

  test("RF-404: otra familia no ve las sesiones de un niño ajeno", async () => {
    const datos = cuerpo(await http.sesionesAnticipables(peticion("GET", "familia/sesiones-anticipables", otraFamilia.jwt), invocacion)) as { sesiones: { catequizandoId: string }[] };
    expect(datos.sesiones.map(s => s.catequizandoId)).toEqual(otraFamilia.hijos);
  });
});

describe("POST /evidencias/reservas", () => {
  const reservar = (jwt: string, archivos: unknown[]) => http.reservarEvidencia(peticion("POST", "evidencias/reservas", jwt, { evidenciaId: randomUUID(), archivos }), invocacion);

  test("RNF-402: una reserva con un archivo declarado de más de 300 KB responde 400", async () => {
    const r = await reservar(familia.jwt, [archivo(1, 307_201)]);
    expect(r.status).toBe(400);
    expect(cuerpo(r).codigo).toBe("tamano_invalido");
  });

  test("RF-402: una reserva con más de 3 archivos responde 400", async () => {
    const r = await reservar(familia.jwt, [1, 2, 3, 4].map(o => archivo(o)));
    expect(r.status).toBe(400);
    expect(cuerpo(r).codigo).toBe("cantidad_fotos");
    expect((await reservar(familia.jwt, [archivo(1), archivo(3)])).status).toBe(400);
  });

  test("RNF-403: devuelve una SAS de solo crear y 5 min por archivo", async () => {
    const evidenciaId = randomUUID();
    const antes = Date.now();
    const r = await http.reservarEvidencia(peticion("POST", "evidencias/reservas", familia.jwt, { evidenciaId, archivos: [archivo(1), archivo(2)] }), invocacion);
    expect(r.status).toBe(201);
    const datos = cuerpo(r) as { evidenciaId: string; expiraEn: string; archivos: { orden: number; url: string }[] };
    expect(datos.archivos.map(a => a.orden)).toEqual([1, 2]);
    for (const a of datos.archivos) {
      const url = new URL(a.url);
      expect(url.searchParams.get("sp")).toBe("c");
      expect(url.pathname.endsWith(`/${cicloId}/${evidenciaId}/${a.orden}.jpg`)).toBe(true);
    }
    expect(Date.parse(datos.expiraEn) - antes).toBeLessThanOrEqual(VIGENCIA_SAS_MS + 1000);
    expect((await enTx(bd, tx => repositorioEvidenciasPg.obtener(tx, evidenciaId)))?.estado).toBe("reservada");
  });

  test("RNF-403: un catequista recibe 403", async () => {
    expect((await reservar(jwtCatequista, [archivo(1)])).status).toBe(403);
  });

  test("RNF-403: la reserva 21 de una cuenta en una hora responde 429", async () => {
    await q("INSERT INTO contador_limite(cuenta_id,operacion,ventana,cantidad) VALUES($1,'justificaciones:reserva:hora',floor(extract(epoch FROM clock_timestamp())/3600)::bigint,20)", [otraFamilia.cuentaId]);
    const r = await reservar(otraFamilia.jwt, [archivo(1)]);
    expect(r.status).toBe(429);
    expect(cuerpo(r).codigo).toBe("limite_excedido");
  });

  test("RNF-403: el contador por cuenta es atómico entre conexiones concurrentes", async () => {
    const cuenta = randomUUID();
    const resultados = await Promise.allSettled(Array.from({ length: 15 }, () => limitarPorCuenta(cuenta, "justificaciones:reserva", 10, 60)));
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(10);
    expect(resultados.filter(r => r.status === "rejected")).toHaveLength(5);
  });
});

describe("Servicio crear-lote con dobles del almacén", () => {
  function almacenFalso(inspecciones: Record<number, InspeccionBlob | undefined>): AlmacenEvidencias & { borrados: string[] } {
    const borrados: string[] = [];
    return {
      borrados,
      urlSubida: async () => ({ url: "https://falso/subida", expiraEn: new Date().toISOString() }),
      urlLectura: async () => ({ url: "https://falso/lectura", expiraEn: new Date().toISOString() }),
      inspeccionar: async nombre => inspecciones[Number(nombre.slice(-5, -4))],
      borrar: async nombre => { borrados.push(nombre); },
      borrarPrefijo: async prefijo => { borrados.push(prefijo); return 1; },
    };
  }
  const valida: InspeccionBlob = { bytes: 100_000, contentType: "image/jpeg", firmaJpeg: true };
  let ctx: ContextoAcceso;
  beforeAll(async () => { ctx = (await cargarContexto({ cuentaId: familia.cuentaId, credencialId: familia.credencialId, tipo: "familia" }))!; });

  /** Cada caso corre en una transacción que se deshace: no consume ausencias de otras pruebas. */
  async function enRetroceso<T>(operacion: (tx: import("pg").PoolClient, evidenciaId: string) => Promise<T>): Promise<T> {
    const cliente = await bd.app.connect();
    const evidenciaId = randomUUID();
    try {
      await cliente.query("BEGIN");
      await repositorioEvidenciasPg.reservar(cliente, { id: evidenciaId, cicloId, subidaPor: familia.cuentaId, en: new Date() });
      return await operacion(cliente, evidenciaId);
    } finally { await cliente.query("ROLLBACK"); cliente.release(); }
  }
  const entrada = (evidenciaId: string, cambios: Partial<EntradaLoteHttp> = {}): EntradaLoteHttp => ({ loteId: randomUUID(), evidenciaId, causa: "salud_nino", ausencias: [item(familia.hijos[0], sesiones.servicio)], ...cambios });

  test("RF-402: rechaza una causa no listada", async () => {
    await enRetroceso(async (tx, evidenciaId) => {
      await expect(crearLote(entrada(evidenciaId, { causa: "viaje" }), ctx, almacenFalso({ 1: valida }), new Date(), tx)).rejects.toMatchObject({ estado: 400, codigo: "causa_invalida" });
    });
  });

  test("RNF-402: un blob de más de 300 KB o sin firma JPEG invalida el lote y se borra", async () => {
    for (const mala of [{ ...valida, bytes: 307_201 }, { ...valida, firmaJpeg: false }]) {
      await enRetroceso(async (tx, evidenciaId) => {
        const almacen = almacenFalso({ 1: mala });
        await expect(crearLote(entrada(evidenciaId), ctx, almacen, new Date(), tx)).rejects.toMatchObject({ estado: 400, codigo: "evidencia_invalida" });
        expect(almacen.borrados).toEqual([`${cicloId}/${evidenciaId}/`]);
        expect((await tx.query("SELECT count(*)::int AS n FROM justificacion WHERE evidencia_id=$1", [evidenciaId])).rows[0].n).toBe(0);
      });
    }
  });

  test("RF-403: una evidencia, tres justificaciones ligadas a sus fechas", async () => {
    await enRetroceso(async (tx, evidenciaId) => {
      const ausencias = [item(familia.hijos[0], sesiones.servicio), item(familia.hijos[0], sesiones.servicio2), item(familia.hijos[1], sesiones.servicio)];
      const { creado, justificaciones } = await crearLote(entrada(evidenciaId, { ausencias }), ctx, almacenFalso({ 1: valida }), new Date(), tx);
      expect(creado).toBe(true);
      expect(justificaciones).toHaveLength(3);
      expect(new Set(justificaciones.map(j => j.evidenciaId))).toEqual(new Set([evidenciaId]));
      expect(justificaciones.map(j => `${j.catequizandoId}|${j.fecha}`).sort()).toEqual([`${familia.hijos[0]}|${dia(-5)}`, `${familia.hijos[0]}|${dia(-4)}`, `${familia.hijos[1]}|${dia(-4)}`].sort());
      expect(justificaciones.every(j => j.enviadaPor === familia.apoderadoId && j.canal === "enlace" && j.tipoSesion === "misa")).toBe(true);
    });
  });

  test("RF-407: al crear el lote la evidencia pasa a confirmada", async () => {
    await enRetroceso(async (tx, evidenciaId) => {
      await crearLote(entrada(evidenciaId), ctx, almacenFalso({ 1: valida, 2: valida }), new Date(), tx);
      const evidencia = await repositorioEvidenciasPg.obtener(tx, evidenciaId);
      expect(evidencia).toMatchObject({ estado: "confirmada" });
      expect(evidencia?.archivos.map(a => a.blobNombre)).toEqual([nombreBlob(cicloId, evidenciaId, 1), nombreBlob(cicloId, evidenciaId, 2)]);
    });
  });
});

describe("POST /justificaciones/lotes y GET /familia/justificaciones", () => {
  const enviar = (jwt: string, cuerpoLote: unknown) => http.crearLote(peticion("POST", "justificaciones/lotes", jwt, cuerpoLote), invocacion);
  let rechazadaId: string;

  test("RF-403: reenviar el mismo loteId devuelve el mismo resultado", async () => {
    const lote = { loteId: randomUUID(), evidenciaId: await evidenciaSubida(familia.jwt), causa: "salud_nino", ausencias: [item(familia.hijos[0], sesiones.reciente)] };
    const primera = await enviar(familia.jwt, lote);
    expect(primera.status).toBe(201);
    const segunda = await enviar(familia.jwt, lote);
    expect(segunda.status).toBe(200);
    expect(segunda.jsonBody).toEqual(primera.jsonBody);
    const [j] = (cuerpo(primera).justificaciones as { id: string; fecha: string; estado: string }[]);
    expect(j).toMatchObject({ id: lote.ausencias[0].justificacionId, fecha: dia(-2), estado: "pendiente" });
    rechazadaId = j.id;
    const justificables = cuerpo(await http.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables", familia.jwt), invocacion)) as { ausencias: { catequizandoId: string; sesionId: string }[] };
    expect(justificables.ausencias.some(a => a.catequizandoId === familia.hijos[0] && a.sesionId === sesiones.reciente)).toBe(false);
  });

  test("RF-401: un apoderado que justifica a un niño ajeno recibe 403", async () => {
    const lote = { loteId: randomUUID(), evidenciaId: await evidenciaSubida(familia.jwt), causa: "salud_nino", ausencias: [item(otraFamilia.hijos[0], sesiones.ajena)] };
    expect((await enviar(familia.jwt, lote)).status).toBe(403);
  });

  test("RF-404: una anticipada con causa evento_escolar responde 201", async () => {
    const evidenciaId = await evidenciaSubida(familia.jwt);
    const conSalud = { loteId: randomUUID(), evidenciaId, causa: "salud_nino", ausencias: [item(familia.hijos[1], sesiones.futura, true)] };
    const rechazo = await enviar(familia.jwt, conSalud);
    expect(rechazo.status).toBe(400);
    expect(cuerpo(rechazo).codigo).toBe("anticipada_no_permitida");
    const r = await enviar(familia.jwt, { ...conSalud, loteId: randomUUID(), causa: "evento_escolar" });
    expect(r.status).toBe(201);
    expect(cuerpo(r).justificaciones).toEqual([expect.objectContaining({ catequizandoId: familia.hijos[1], sesionId: sesiones.futura, fecha: dia(7), anticipada: true })]);
  });

  test("RF-410: la familia ve el estado y el motivo de rechazo", async () => {
    await enTx(bd, async tx => {
      const j = (await repo.obtener(tx, rechazadaId))!;
      await repo.guardarRevision(tx, revisar(j, "rechazada", coordinadorId, new Date().toISOString(), "La foto no se lee"));
    });
    const r = await http.misJustificaciones(peticion("GET", "familia/justificaciones", familia.jwt), invocacion);
    expect(r.status).toBe(200);
    const lista = (cuerpo(r).justificaciones as { id: string; estado: string; motivoRechazo: string | null; origen: string; causa: string | null }[]);
    expect(lista.find(j => j.id === rechazadaId)).toMatchObject({ estado: "rechazada", motivoRechazo: "La foto no se lee", origen: "usted", causa: "salud_nino" });
    expect(lista.filter(j => j.estado === "pendiente").every(j => j.motivoRechazo === null)).toBe(true);
    const justificables = cuerpo(await http.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables", familia.jwt), invocacion)) as { ausencias: { catequizandoId: string; sesionId: string }[] };
    expect(justificables.ausencias.some(a => a.catequizandoId === familia.hijos[0] && a.sesionId === sesiones.reciente)).toBe(true);
  });

  test("RF-410: la familia no obtiene URL de evidencia", async () => {
    const texto = JSON.stringify((await http.misJustificaciones(peticion("GET", "familia/justificaciones", familia.jwt), invocacion)).jsonBody);
    expect(texto).not.toMatch(/evidencia|https?:|blob|\.jpg|sig=/i);
  });

  test("RF-410: una enviada por otro apoderado se etiqueta «otro apoderado» sin su nombre", async () => {
    const otroApoderado = randomUUID(), evidenciaId = randomUUID();
    await q("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto) VALUES($1,'Bernardo','Secreto','otro','prueba')", [otroApoderado]);
    await q("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'padre')", [randomUUID(), familia.hijos[0], otroApoderado]);
    await q("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidenciaId, cicloId, coordinadorId]);
    const [j] = expandirLote({ loteId: randomUUID(), cicloId, causa: "familiar_directo", evidenciaId, cantidadFotos: 1, apoderadoId: otroApoderado, canal: "enlace",
      ausencias: [{ catequizandoId: familia.hijos[0], sesionId: sesiones.ajena, tipoSesion: "misa", fecha: dia(-3), justificacionId: randomUUID(), anticipada: false }] }, new Date().toISOString());
    await enTx(bd, tx => repo.insertarLote(tx, [j], coordinadorId));
    const r = await http.misJustificaciones(peticion("GET", "familia/justificaciones", familia.jwt), invocacion);
    const lista = cuerpo(r).justificaciones as { id: string; origen: string; causa: string | null }[];
    expect(lista.find(x => x.id === j.id)).toMatchObject({ origen: "otro_apoderado", causa: null });
    expect(JSON.stringify(r.jsonBody)).not.toMatch(/Bernardo|Secreto|familiar_directo/);
  });

  test("RF-406: una registrada por la coordinación se etiqueta como tal", async () => {
    const evidenciaId = randomUUID();
    await q("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidenciaId, cicloId, coordinadorId]);
    const [j] = expandirLote({ loteId: randomUUID(), cicloId, causa: "salud_nino", evidenciaId, cantidadFotos: 1, apoderadoId: familia.apoderadoId, canal: "coordinacion", registradaPor: coordinadorId,
      ausencias: [{ catequizandoId: familia.hijos[1], sesionId: sesiones.ajena, tipoSesion: "misa", fecha: dia(-3), justificacionId: randomUUID(), anticipada: false }] }, new Date().toISOString());
    await enTx(bd, tx => repo.insertarLote(tx, [j], coordinadorId));
    const lista = cuerpo(await http.misJustificaciones(peticion("GET", "familia/justificaciones", familia.jwt), invocacion)).justificaciones as { id: string; origen: string }[];
    expect(lista.find(x => x.id === j.id)).toMatchObject({ origen: "coordinacion" });
  });

  test("RF-408: con el ciclo cerrado responde 409", async () => {
    const lote = { loteId: randomUUID(), evidenciaId: await evidenciaSubida(familia.jwt), causa: "salud_nino", ausencias: [item(familia.hijos[1], sesiones.reciente)] };
    await q("UPDATE ciclo SET estado='cerrado',cerrado_por=$2,cerrado_en=now() WHERE id=$1", [cicloId, coordinadorId]);
    const r = await enviar(familia.jwt, lote);
    expect(r.status).toBe(409);
    expect(cuerpo(r).codigo).toBe("ciclo_no_abierto");
  });
});
