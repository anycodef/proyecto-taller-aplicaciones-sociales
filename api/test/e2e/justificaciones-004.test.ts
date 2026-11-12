import { randomBytes, randomUUID } from "node:crypto";
import { HttpRequest, InvocationContext, type HttpResponseInit } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import type { Pool } from "pg";
import { hoyEnLima } from "@/lib/seguridad/fechas";
import { enTransaccion } from "../../src/compartido/bd/transaccion";
import { consultarFaltas } from "../../src/modulos/asistencia/aplicacion/consultar-faltas";
import { consolidarPar } from "../../src/modulos/asistencia/aplicacion/procesar-marcas";
import { fuenteJustificacionesVacia, registrarAlCambiarAsistencia, registrarFuenteJustificaciones } from "../../src/modulos/asistencia/dominio/puertos";
import { alCambiarAsistencia } from "../../src/modulos/justificaciones/aplicacion/al-cambiar-asistencia";
import { consultaJustificaciones, fuenteJustificacionesAprobadas } from "../../src/modulos/justificaciones/aplicacion/consulta-justificaciones";
import { manejadoresCoordinacion as coord, manejadoresJustificaciones as familiaHttp } from "../../src/modulos/justificaciones/http";
import { configurarAlmacenEvidencias } from "../../src/modulos/justificaciones/infraestructura/almacen";
import { crearAlmacenEvidencias } from "../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";
import { revocarEnlace } from "../../src/modulos/seguridad/aplicacion/cuentas";
import { firmarJwt } from "../../src/modulos/seguridad/infraestructura/firmador-jwt";
import { prepararBd, type BdPrueba } from "../integracion/justificaciones/soporte";

let bd: BdPrueba;
let pool: Pool;
jest.mock("../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (texto: string, valores: unknown[]) => pool.query(texto, valores) }));

const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
const contenedor = BlobServiceClient.fromConnectionString(conexion).getContainerClient(`evidencias-${randomUUID()}`);
const claveAnterior = process.env.JWT_CLAVE;
const invocacion = new InvocationContext({ functionName: "e2e004" });
const hoy = hoyEnLima(new Date());
const dia = (d: number) => { const f = new Date(`${hoy}T12:00:00Z`); f.setUTCDate(f.getUTCDate() + d); return f.toISOString().slice(0, 10); };
const cicloId = randomUUID(), grupoId = randomUUID();
// Misas pasadas: sin registro y con la ventana cerrada cuentan como ausencia (003).
const misas = { d1: randomUUID(), d2: randomUUID(), d3: randomUUID(), d4: randomUUID(), d5: randomUUID(), d6: randomUUID(), d9: randomUUID(), d20: randomUUID() };
const desplazamiento: Record<keyof typeof misas, number> = { d1: -1, d2: -2, d3: -3, d4: -4, d5: -5, d6: -6, d9: -9, d20: -20 };
const catequesisD2 = randomUUID();
type Actor = { cuentaId: string; jwt: string };
let coordinador: Actor, familia: Actor & { apoderadoId: string }, ninoId: string;

const q = (texto: string, valores: unknown[] = []) => bd.admin.query(texto, valores);

beforeAll(async () => {
  process.env.JWT_CLAVE = "clave-de-prueba-004-e2e-sin-uso-en-produccion";
  bd = await prepararBd("e2e004");
  pool = bd.app;
  await contenedor.create();
  configurarAlmacenEvidencias(crearAlmacenEvidencias({ modo: "pruebas", conexion, contenedor: contenedor.containerName }));
  registrarFuenteJustificaciones(fuenteJustificacionesAprobadas);
  registrarAlCambiarAsistencia(alCambiarAsistencia);

  const coordId = randomUUID(), credCoord = randomUUID(), dispositivo = randomUUID();
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Coordinación e2e',false)", [coordId]);
  await q("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'coordinacion')", [coordId]);
  await q("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado,dispositivo_id) VALUES($1,$2,'equipo',$3,'activa',$4)", [credCoord, coordId, randomBytes(32), dispositivo]);
  coordinador = { cuentaId: coordId, jwt: await firmarJwt({ cuentaId: coordId, credencialId: credCoord, tipo: "equipo", dispositivoId: dispositivo }) };

  await q("INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,'Ciclo e2e',$2,$3,$4)", [cicloId, dia(-90), dia(90), coordId]);
  await q("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Grupo A',8,13,'mixto')", [grupoId, cicloId]);
  for (const [clave, d] of Object.entries(desplazamiento)) await q("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,$3,'misa')", [misas[clave as keyof typeof misas], cicloId, dia(d)]);
  await q("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,$3,'catequesis')", [catequesisD2, cicloId, dia(-2)]);

  const cuentaFamilia = randomUUID(), credFamilia = randomUUID(), apoderadoId = randomUUID();
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Familia e2e',false)", [cuentaFamilia]);
  await q("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'familia')", [cuentaFamilia]);
  await q("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'familia',$3,'activa')", [credFamilia, cuentaFamilia, randomBytes(32)]);
  await q("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto,cuenta_id) VALUES($1,'Rosa','Quispe','otro','prueba',$2)", [apoderadoId, cuentaFamilia]);
  familia = { cuentaId: cuentaFamilia, apoderadoId, jwt: await firmarJwt({ cuentaId: cuentaFamilia, credencialId: credFamilia, tipo: "familia" }) };

  ninoId = randomUUID();
  const consentimiento = randomUUID(), inscripcion = randomUUID(), desde = `${dia(-90)}T05:00:00Z`;
  await q("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,'Ana','Quispe','2016-01-01','femenino',true,$2)", [ninoId, coordId]);
  await q("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, ninoId, apoderadoId, coordId]);
  await q("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,10,false,'prueba',$5)", [inscripcion, ninoId, cicloId, consentimiento, desde]);
  await q("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,$5)", [randomUUID(), inscripcion, grupoId, coordId, desde]);
  await q("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'madre')", [randomUUID(), ninoId, apoderadoId]);
  // Catequesis del mismo domingo también ausente: ese día hay falta (misa y catequesis).
  await q(`INSERT INTO asistencia(id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,hora_primer_registro,recibido_primer_registro,corregida,conflicto)
    VALUES($1,$2,$3,$4,'ausente','manual',$5,$5,false,false)`, [randomUUID(), cicloId, catequesisD2, ninoId, `${dia(-2)}T16:00:00Z`]);
}, 120000);
afterAll(async () => {
  registrarFuenteJustificaciones(fuenteJustificacionesVacia);
  configurarAlmacenEvidencias(undefined);
  await contenedor.deleteIfExists();
  await bd?.cerrar();
  if (claveAnterior === undefined) delete process.env.JWT_CLAVE; else process.env.JWT_CLAVE = claveAnterior;
});

function peticion(metodo: string, ruta: string, actor: Actor, cuerpo?: unknown, params: Record<string, string> = {}): HttpRequest {
  return new HttpRequest({ method: metodo, url: `http://localhost/api/${ruta}`, headers: { Authorization: `Bearer ${actor.jwt}`, "content-type": "application/json" }, params, ...(cuerpo === undefined ? {} : { body: { string: JSON.stringify(cuerpo) } }) });
}
type Cuerpo = Record<string, unknown> & { codigo?: string };
const cuerpo = (r: HttpResponseInit) => r.jsonBody as Cuerpo;
const jpeg = new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(119_996, 7)]));

const justificables = async () => {
  const r = await familiaHttp.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables", familia), invocacion);
  expect(r.status).toBe(200);
  return (cuerpo(r).ausencias as { sesionId: string }[]).map(a => a.sesionId);
};
async function enviar(sesionIds: string[]): Promise<string[]> {
  const evidenciaId = randomUUID();
  const reserva = await familiaHttp.reservarEvidencia(peticion("POST", "evidencias/reservas", familia, { evidenciaId, archivos: [{ orden: 1, bytes: jpeg.length, contentType: "image/jpeg" }] }), invocacion);
  expect(reserva.status).toBe(201);
  const [{ url }] = cuerpo(reserva).archivos as { url: string }[];
  expect((await fetch(url, { method: "PUT", body: jpeg, headers: { "x-ms-blob-type": "BlockBlob", "content-type": "image/jpeg" } })).status).toBe(201);
  const lote = { loteId: randomUUID(), evidenciaId, causa: "salud_nino", ausencias: sesionIds.map(sesionId => ({ justificacionId: randomUUID(), catequizandoId: ninoId, sesionId, anticipada: false })) };
  const r = await familiaHttp.crearLote(peticion("POST", "justificaciones/lotes", familia, lote), invocacion);
  expect(r.status).toBe(201);
  return (cuerpo(r).justificaciones as { id: string }[]).map(j => j.id);
}
const bandeja = async () => {
  const r = await coord.bandeja(peticion("GET", "justificaciones/bandeja", coordinador), invocacion);
  expect(r.status).toBe(200);
  return cuerpo(r).lotes as { loteId: string; evidenciaId: string; justificaciones: { id: string }[] }[];
};
const revisar = async (ids: string[], decision: "aprobada" | "rechazada", motivo?: string) => {
  const r = await coord.revisar(peticion("POST", "justificaciones/revisiones", coordinador, { ids, decision, ...(motivo ? { motivo } : {}) }), invocacion);
  expect(r.status).toBe(200);
};
const faltaDelDia2 = async () => (await enTransaccion(tx => consultarFaltas(cicloId, { catequizandoId: ninoId }, tx))).find(f => f.fecha === dia(-2));

describe("e2e", () => {
  test("RF-409: tras aprobar, la falta deja de contar", async () => {
    const ofrecidas = await justificables();
    for (const sesion of [misas.d2, misas.d3, misas.d4]) expect(ofrecidas).toContain(sesion);
    expect((await faltaDelDia2())?.justificada).toBe(false);

    const ids = await enviar([misas.d2, misas.d3, misas.d4]);
    expect(ids).toHaveLength(3);
    const evidencias = await q("SELECT DISTINCT evidencia_id FROM justificacion WHERE id=ANY($1::uuid[])", [ids]);
    expect(evidencias.rowCount).toBe(1);
    expect((await q("SELECT estado FROM evidencia WHERE id=$1", [evidencias.rows[0].evidencia_id])).rows[0].estado).toBe("confirmada");

    const lote = (await bandeja()).find(l => l.justificaciones.some(j => ids.includes(j.id)));
    expect(lote?.justificaciones.map(j => j.id).sort()).toEqual([...ids].sort());
    await revisar(ids, "aprobada");

    expect((await faltaDelDia2())?.justificada).toBe(true);
    expect(await enTransaccion(tx => consultaJustificaciones.faltaJustificada(cicloId, { catequizandoId: ninoId, fecha: dia(-2) }, tx))).toBe(true);
    expect(await justificables()).not.toContain(misas.d2);
  });

  test("RF-408: una rechazada con motivo y plazo vigente vuelve a ofrecerse", async () => {
    const [id] = await enviar([misas.d5]);
    expect(await justificables()).not.toContain(misas.d5);
    await revisar([id!], "rechazada", "La foto no se lee");
    expect(await justificables()).toContain(misas.d5);
    const mias = cuerpo(await familiaHttp.misJustificaciones(peticion("GET", "familia/justificaciones", familia), invocacion)).justificaciones as { id: string; estado: string; motivoRechazo: string | null }[];
    expect(mias.find(j => j.id === id)).toMatchObject({ estado: "rechazada", motivoRechazo: "La foto no se lee" });
  });

  test("RF-407: una ausencia corregida a presente queda sin efecto y se conserva", async () => {
    const [id] = await enviar([misas.d6]);
    await revisar([id!], "aprobada");
    await enTransaccion(async tx => {
      await tx.query(`INSERT INTO correccion_asistencia(id,ciclo_id,sesion_id,catequizando_id,valor_anterior,valor_nuevo,corregido_por,hora_dispositivo,desfase_reloj_ms,estado,huella_peticion)
        VALUES($1,$2,$3,$4,'ausente','presente',$5,now(),0,'aceptada','e2e')`, [randomUUID(), cicloId, misas.d6, ninoId, coordinador.cuentaId]);
      await consolidarPar(misas.d6, ninoId, tx);
    });
    const fila = (await q("SELECT estado_revision,sin_efecto_desde FROM justificacion WHERE id=$1", [id])).rows[0];
    expect(fila.estado_revision).toBe("aprobada");
    expect(fila.sin_efecto_desde).not.toBeNull();
    const mias = cuerpo(await familiaHttp.misJustificaciones(peticion("GET", "familia/justificaciones", familia), invocacion)).justificaciones as { id: string; estado: string }[];
    expect(mias.find(j => j.id === id)?.estado).toBe("sin_efecto");
  });

  test("RF-408: las pendientes de un enlace revocado siguen en la bandeja", async () => {
    const [id] = await enviar([misas.d1]);
    await revocarEnlace(familia.cuentaId);
    expect((await familiaHttp.ausenciasJustificables(peticion("GET", "familia/ausencias-justificables", familia), invocacion)).status).toBe(401);
    expect((await bandeja()).some(l => l.justificaciones.some(j => j.id === id))).toBe(true);
  });

  test("RF-405: vencido el plazo, la ausencia deja de ofrecerse", async () => {
    const ofrecidas = async () => {
      const r = await coord.justificablesDeNino(peticion("GET", `coordinacion/catequizandos/${ninoId}/ausencias-justificables`, coordinador, undefined, { id: ninoId }), invocacion);
      expect(r.status).toBe(200);
      return (cuerpo(r).ausencias as { sesionId: string }[]).map(a => a.sesionId);
    };
    expect(await ofrecidas()).toContain(misas.d5);
    expect(await ofrecidas()).not.toContain(misas.d9);
    expect(await ofrecidas()).not.toContain(misas.d20);
    const plazo = await coord.definirPlazo(peticion("PUT", `ciclos/${cicloId}/plazo-justificacion`, coordinador, { diasPlazo: 10 }, { id: cicloId }), invocacion);
    expect(plazo.status).toBe(200);
    expect(await ofrecidas()).toContain(misas.d9);
    expect(await ofrecidas()).not.toContain(misas.d20);
  });
});
