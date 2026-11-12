import { randomUUID } from "node:crypto";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { consultarAusencias } from "../../../src/modulos/asistencia/aplicacion/consultar-faltas";
import { crearLote } from "../../../src/modulos/justificaciones/aplicacion/crear-lote";
import { obtenerLecturaEvidencia, reservarEvidencia, subirArchivo } from "../../../src/modulos/justificaciones/aplicacion/evidencias";
import { listarJustificables, listarMisJustificaciones } from "../../../src/modulos/justificaciones/aplicacion/familia";
import { consultarBandeja, revisarJustificaciones } from "../../../src/modulos/justificaciones/aplicacion/revision";
import { crearAlmacenEvidenciasMemoria } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";
import { fuenteJustificacionesAprobadasPg } from "../../../src/modulos/justificaciones/infraestructura/puentes-asistencia";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

jest.mock("../../../src/modulos/seguridad", () => ({ auditar: jest.fn(), autenticarPeticion: jest.fn() }));
jest.mock("../../../src/modulos/asistencia/aplicacion/consultar-faltas", () => ({ consultarAusencias: jest.fn() }));

const FECHA = "2026-11-01";
// Dentro del plazo predeterminado de 7 días: vence el 8 de noviembre en Lima.
const AHORA = new Date("2026-11-03T15:00:00Z");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

let bd: BdPrueba;
let s: Semilla;
let familiaId: string;
let coordinacionId: string;
const almacen = crearAlmacenEvidenciasMemoria();

const contexto = (cuentaId: string, rolesPropios: Rol[], hijos: string[] = []): ContextoAcceso => ({
  cuentaId, credencialId: randomUUID(), rolesPropios, gruposAsignados: [], catequizandosApoderados: hijos, identidadOperativa: "Prueba", esMenor: false,
});
const familia = (hijos?: string[]) => contexto(familiaId, ["familia"], hijos ?? [s.catequizandoId, s.hermanoId]);
const coordinacion = () => contexto(coordinacionId, ["coordinacion"]);

beforeAll(async () => {
  bd = await prepararBd("api004");
  s = await sembrar(bd);
  familiaId = randomUUID();
  coordinacionId = s.cuentaId;
  await bd.admin.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Familia 1',false)", [familiaId]);
  await bd.admin.query("UPDATE apoderado SET cuenta_id=$1 WHERE id=$2", [familiaId, s.apoderadoId]);
  await bd.admin.query("UPDATE sesion SET fecha=$2 WHERE ciclo_id=$1", [s.cicloId, FECHA]);
  (consultarAusencias as jest.Mock).mockImplementation(async () => [
    { sesion: { id: s.sesionId, tipo: "misa", fecha: FECHA }, catequizandoId: s.catequizandoId, estado: "ausente" },
    { sesion: { id: s.sesion2Id, tipo: "catequesis", fecha: FECHA }, catequizandoId: s.catequizandoId, estado: "ausente" },
    { sesion: { id: s.sesionId, tipo: "misa", fecha: FECHA }, catequizandoId: s.hermanoId, estado: "ausente" },
    { sesion: { id: s.sesion2Id, tipo: "catequesis", fecha: FECHA }, catequizandoId: s.hermanoId, estado: "ausente" },
  ]);
});
afterAll(async () => { await bd?.cerrar(); });

async function reservarYSubir(ctx: ContextoAcceso, cantidad = 1): Promise<string> {
  const { evidenciaId } = await enTx(bd, (tx) => reservarEvidencia(ctx, Array.from({ length: cantidad }, () => ({ bytes: JPEG.length, contentType: "image/jpeg" })), AHORA, tx));
  for (let orden = 1; orden <= cantidad; orden++) await enTx(bd, (tx) => subirArchivo(ctx, evidenciaId, orden, JPEG, "image/jpeg", almacen, tx));
  return evidenciaId;
}
const ausenciasDe = (...pares: [string, string][]) => pares.map(([catequizandoId, sesionId]) => ({ catequizandoId, sesionId, justificacionId: randomUUID() }));

test("RF-401: la familia ve las ausencias justificables de sus hijos con su plazo", async () => {
  const { ausencias } = await enTx(bd, (tx) => listarJustificables(familia(), AHORA, tx));
  expect(ausencias).toHaveLength(4);
  expect(ausencias[0]).toMatchObject({ fecha: FECHA, nombre: "Ana Prueba" });
  expect(ausencias[0].venceEn).toBe("2026-11-08T23:59:59-05:00");
});

test("RF-405: una ausencia fuera de plazo no aparece como justificable", async () => {
  const { ausencias } = await enTx(bd, (tx) => listarJustificables(familia(), new Date("2026-11-20T15:00:00Z"), tx));
  expect(ausencias).toEqual([]);
});

test("RF-401: un apoderado sin hijos vinculados no ve ausencias", async () => {
  const { ausencias } = await enTx(bd, (tx) => listarJustificables(familia([]), AHORA, tx));
  expect(ausencias).toEqual([]);
});

test("RNF-402: una reserva con un archivo declarado de más de 300 KB responde 400", async () => {
  await expect(enTx(bd, (tx) => reservarEvidencia(familia(), [{ bytes: 300 * 1024 + 1, contentType: "image/jpeg" }], AHORA, tx))).rejects.toMatchObject({ estado: 400, codigo: "tamano_invalido" });
});

test("RF-402: una reserva con más de 3 archivos responde 400", async () => {
  const cuatro = Array.from({ length: 4 }, () => ({ bytes: 1000, contentType: "image/jpeg" }));
  await expect(enTx(bd, (tx) => reservarEvidencia(familia(), cuatro, AHORA, tx))).rejects.toMatchObject({ estado: 400, codigo: "cantidad_fotos" });
});

test("RNF-402: subir un archivo sin firma JPEG o de otro tipo responde 400", async () => {
  const { evidenciaId } = await enTx(bd, (tx) => reservarEvidencia(familia(), [{ bytes: 100, contentType: "image/jpeg" }], AHORA, tx));
  await expect(enTx(bd, (tx) => subirArchivo(familia(), evidenciaId, 1, Buffer.from("no soy jpeg"), "image/jpeg", almacen, tx))).rejects.toMatchObject({ estado: 400, codigo: "firma_invalida" });
  await expect(enTx(bd, (tx) => subirArchivo(familia(), evidenciaId, 1, JPEG, "image/png", almacen, tx))).rejects.toMatchObject({ estado: 400, codigo: "tipo_no_permitido" });
});

test("RNF-403: otra cuenta no puede subir a una evidencia ajena", async () => {
  const { evidenciaId } = await enTx(bd, (tx) => reservarEvidencia(familia(), [{ bytes: 100, contentType: "image/jpeg" }], AHORA, tx));
  await expect(enTx(bd, (tx) => subirArchivo(coordinacion(), evidenciaId, 1, JPEG, "image/jpeg", almacen, tx))).rejects.toMatchObject({ estado: 404 });
});

test("RF-403: un lote con una evidencia crea una justificación por ausencia y reenviarlo devuelve lo mismo", async () => {
  const ctx = familia();
  const evidenciaId = await reservarYSubir(ctx, 2);
  const entrada = { loteId: randomUUID(), causa: "salud_nino", evidenciaId, ausencias: ausenciasDe([s.catequizandoId, s.sesionId], [s.catequizandoId, s.sesion2Id]) };
  const creado = await enTx(bd, (tx) => crearLote(ctx, entrada, almacen, AHORA, tx));
  expect(creado.justificaciones).toHaveLength(2);
  expect(creado.justificaciones.every((j) => j.estadoVisible === "pendiente")).toBe(true);
  const filasEvidencia = await bd.admin.query("SELECT count(*)::int AS n FROM evidencia_archivo WHERE evidencia_id=$1", [evidenciaId]);
  expect(filasEvidencia.rows[0].n).toBe(2);

  const repetido = await enTx(bd, (tx) => crearLote(ctx, entrada, almacen, AHORA, tx));
  expect(repetido).toEqual(creado);
  const { ausencias } = await enTx(bd, (tx) => listarJustificables(ctx, AHORA, tx));
  expect(ausencias).toHaveLength(2);
  expect(ausencias.every((a) => a.catequizandoId === s.hermanoId)).toBe(true);
});

test("RF-401: un apoderado que justifica a un niño ajeno recibe 403", async () => {
  const ctx = familia([s.hermanoId]);
  const evidenciaId = await reservarYSubir(ctx);
  const entrada = { loteId: randomUUID(), causa: "salud_nino", evidenciaId, ausencias: ausenciasDe([randomUUID(), s.sesionId]) };
  await expect(enTx(bd, (tx) => crearLote(ctx, entrada, almacen, AHORA, tx))).rejects.toMatchObject({ estado: 403, codigo: "nino_ajeno" });
});

test("RF-402: rechaza una causa no listada y un lote sin foto subida", async () => {
  const ctx = familia();
  const evidenciaId = await reservarYSubir(ctx);
  await expect(enTx(bd, (tx) => crearLote(ctx, { loteId: randomUUID(), causa: "capricho", evidenciaId, ausencias: ausenciasDe([s.hermanoId, s.sesionId]) }, almacen, AHORA, tx))).rejects.toMatchObject({ estado: 422, codigo: "causa_invalida" });
  const sinFoto = (await enTx(bd, (tx) => reservarEvidencia(ctx, [{ bytes: 100, contentType: "image/jpeg" }], AHORA, tx))).evidenciaId;
  await expect(enTx(bd, (tx) => crearLote(ctx, { loteId: randomUUID(), causa: "salud_nino", evidenciaId: sinFoto, ausencias: ausenciasDe([s.hermanoId, s.sesionId]) }, almacen, AHORA, tx))).rejects.toMatchObject({ estado: 422, codigo: "sin_evidencia" });
});

test("RNF-403: la reserva 21 de una cuenta en una hora responde 429", async () => {
  const cuenta = randomUUID();
  await bd.admin.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Familia 2',false)", [cuenta]);
  const ctx = contexto(cuenta, ["familia"], []);
  for (let i = 0; i < 20; i++) await enTx(bd, (tx) => reservarEvidencia(ctx, [{ bytes: 100, contentType: "image/jpeg" }], AHORA, tx));
  await expect(enTx(bd, (tx) => reservarEvidencia(ctx, [{ bytes: 100, contentType: "image/jpeg" }], AHORA, tx))).rejects.toMatchObject({ estado: 429 });
});

test("RF-403: la bandeja agrupa por lote y la aprobación hace que la fuente de 003 devuelva la falta", async () => {
  const ctx = familia();
  const evidenciaId = await reservarYSubir(ctx);
  const entrada = { loteId: randomUUID(), causa: "familiar_directo", evidenciaId, ausencias: ausenciasDe([s.hermanoId, s.sesionId]) };
  await enTx(bd, (tx) => crearLote(ctx, entrada, almacen, AHORA, tx));

  const bandeja = await enTx(bd, (tx) => consultarBandeja(tx));
  const lote = bandeja.lotes.find((l) => l.loteId === entrada.loteId);
  expect(lote?.justificaciones).toHaveLength(1);
  expect(lote?.justificaciones[0]).toMatchObject({ nombre: "Ana Prueba", causa: "familiar_directo", canal: "enlace", duplicada: false });

  const antes = await enTx(bd, (tx) => fuenteJustificacionesAprobadasPg.consultar(s.cicloId, tx));
  expect(antes.some((f) => f.catequizandoId === s.hermanoId)).toBe(false);

  const id = entrada.ausencias[0].justificacionId;
  const revision = await enTx(bd, (tx) => revisarJustificaciones(coordinacion(), { justificacionIds: [id], decision: "aprobada" }, AHORA, tx));
  expect(revision.revisadas).toEqual([{ id, estadoVisible: "aprobada" }]);

  const despues = await enTx(bd, (tx) => fuenteJustificacionesAprobadasPg.consultar(s.cicloId, tx));
  expect(despues).toContainEqual({ catequizandoId: s.hermanoId, fecha: FECHA });
  expect((await enTx(bd, (tx) => consultarBandeja(tx))).lotes.some((l) => l.loteId === entrada.loteId)).toBe(false);
  await expect(enTx(bd, (tx) => revisarJustificaciones(coordinacion(), { justificacionIds: [id], decision: "rechazada", motivo: "tarde" }, AHORA, tx))).rejects.toMatchObject({ estado: 409, codigo: "no_pendiente" });
});

test("RF-406: rechazar exige motivo y la familia lo ve sin URL de evidencia", async () => {
  const ctx = familia();
  const evidenciaId = await reservarYSubir(ctx);
  const entrada = { loteId: randomUUID(), causa: "evento_escolar", evidenciaId, ausencias: ausenciasDe([s.hermanoId, s.sesion2Id]) };
  await enTx(bd, (tx) => crearLote(ctx, entrada, almacen, AHORA, tx));
  const id = entrada.ausencias[0].justificacionId;
  await expect(enTx(bd, (tx) => revisarJustificaciones(coordinacion(), { justificacionIds: [id], decision: "rechazada" }, AHORA, tx))).rejects.toMatchObject({ estado: 422, codigo: "motivo_requerido" });
  await enTx(bd, (tx) => revisarJustificaciones(coordinacion(), { justificacionIds: [id], decision: "rechazada", motivo: "El comprobante no es legible" }, AHORA, tx));

  const { justificaciones } = await enTx(bd, (tx) => listarMisJustificaciones(ctx, tx));
  const rechazada = justificaciones.find((j) => j.id === id);
  expect(rechazada).toMatchObject({ estadoVisible: "rechazada", motivoRechazo: "El comprobante no es legible", origen: "propia" });
  expect(JSON.stringify(justificaciones)).not.toMatch(/https?:|evidencia/i);
  const { ausencias } = await enTx(bd, (tx) => listarJustificables(ctx, AHORA, tx));
  expect(ausencias.some((a) => a.catequizandoId === s.hermanoId && a.sesionId === s.sesion2Id)).toBe(true);
});

test("RNF-403: la coordinación obtiene una URL temporal de la evidencia y la consulta se audita", async () => {
  const ctx = familia();
  const evidenciaId = await reservarYSubir(ctx, 2);
  const entrada = { loteId: randomUUID(), causa: "salud_nino", evidenciaId, ausencias: ausenciasDe([s.hermanoId, s.sesion2Id]) };
  await enTx(bd, (tx) => crearLote(ctx, entrada, almacen, AHORA, tx));
  const lectura = await enTx(bd, (tx) => obtenerLecturaEvidencia(coordinacion(), entrada.ausencias[0].justificacionId, almacen, AHORA, tx));
  expect(lectura.urls).toHaveLength(2);
  expect(lectura.url).toBe(lectura.urls[0]);
  expect(Date.parse(lectura.expiraEn) - AHORA.getTime()).toBe(5 * 60_000);
  const { auditar } = jest.requireMock("../../../src/modulos/seguridad") as { auditar: jest.Mock };
  expect(auditar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "evidencia:leer", resultado: "permitido" }), expect.anything());
});

// Cerrar un ciclo es irreversible (trigger ciclo_cerrado): esta prueba va la última.
test("RF-408: con el ciclo cerrado no se reserva ni se envía", async () => {
  await bd.admin.query("UPDATE ciclo SET estado='cerrado' WHERE id=$1", [s.cicloId]);
  await expect(enTx(bd, (tx) => reservarEvidencia(familia(), [{ bytes: 100, contentType: "image/jpeg" }], AHORA, tx))).rejects.toMatchObject({ estado: 409, codigo: "ciclo_no_abierto" });
});
