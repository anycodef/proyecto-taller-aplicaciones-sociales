import { HttpRequest, type InvocationContext } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { autenticarPeticion } from "../../../src/modulos/seguridad";
import { crearLote } from "../../../src/modulos/justificaciones/aplicacion/crear-lote";
import { obtenerLecturaEvidencia, reservarEvidencia, subirArchivo } from "../../../src/modulos/justificaciones/aplicacion/evidencias";
import { consultarBandeja, revisarJustificaciones } from "../../../src/modulos/justificaciones/aplicacion/revision";
import { listarJustificables } from "../../../src/modulos/justificaciones/aplicacion/familia";
import { manejadoresJustificaciones as m } from "../../../src/modulos/justificaciones/http";
import { configurarAlmacenEvidencias, crearAlmacenEvidenciasMemoria } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";

jest.mock("../../../src/modulos/seguridad", () => ({ autenticarPeticion: jest.fn(), auditar: jest.fn() }));
jest.mock("../../../src/compartido/http/limites", () => ({ limitarPorCuenta: jest.fn() }));
jest.mock("../../../src/compartido/bd/transaccion", () => ({ enTransaccion: (operacion: (tx: unknown) => Promise<unknown>) => operacion({}) }));
jest.mock("../../../src/modulos/justificaciones/aplicacion/crear-lote", () => ({ crearLote: jest.fn() }));
jest.mock("../../../src/modulos/justificaciones/aplicacion/evidencias", () => ({ reservarEvidencia: jest.fn(), subirArchivo: jest.fn(), obtenerLecturaEvidencia: jest.fn() }));
jest.mock("../../../src/modulos/justificaciones/aplicacion/revision", () => ({ consultarBandeja: jest.fn(), revisarJustificaciones: jest.fn() }));
jest.mock("../../../src/modulos/justificaciones/aplicacion/familia", () => ({ listarJustificables: jest.fn(), listarMisJustificaciones: jest.fn() }));

const id = "00400000-0000-4000-8000-000000000001";
const inv = {} as InvocationContext;
const contexto = (...rolesPropios: Rol[]): ContextoAcceso => ({
  cuentaId: id, credencialId: id, rolesPropios, gruposAsignados: [id], catequizandosApoderados: [id], identidadOperativa: "Prueba", esMenor: false,
});
const como = (...roles: Rol[]) => (autenticarPeticion as jest.Mock).mockResolvedValue(roles.length ? contexto(...roles) : undefined);
const json = (metodo: "GET" | "POST", ruta: string, cuerpo?: unknown) =>
  new HttpRequest({ method: metodo, url: `https://sigecat.example/v1/${ruta}`, headers: { "content-type": "application/json" }, ...(cuerpo === undefined ? {} : { body: { string: JSON.stringify(cuerpo) } }) });

beforeEach(() => { jest.clearAllMocks(); configurarAlmacenEvidencias(crearAlmacenEvidenciasMemoria()); });

test("RF-401: sin token responde 401", async () => {
  como();
  expect((await m.ausenciasJustificables(json("GET", "familia/ausencias-justificables"), inv)).status).toBe(401);
});

test("RF-401: un catequista recibe 403 en las rutas de la familia", async () => {
  como("catequista");
  expect((await m.ausenciasJustificables(json("GET", "familia/ausencias-justificables"), inv)).status).toBe(403);
  expect((await m.reservar(json("POST", "evidencias/reservas", { archivos: [{ bytes: 10, contentType: "image/jpeg" }] }), inv)).status).toBe(403);
  expect(reservarEvidencia).not.toHaveBeenCalled();
});

test("RF-401: la familia recibe sus ausencias justificables", async () => {
  como("familia");
  (listarJustificables as jest.Mock).mockResolvedValue({ ausencias: [] });
  const r = await m.ausenciasJustificables(json("GET", "familia/ausencias-justificables"), inv);
  expect(r).toMatchObject({ status: 200, jsonBody: { ausencias: [] }, headers: { "Cache-Control": "no-store" } });
});

test("RF-402: la reserva responde 201 con el identificador y rechaza campos desconocidos con 422", async () => {
  como("familia");
  (reservarEvidencia as jest.Mock).mockResolvedValue({ evidenciaId: id, archivos: [{ orden: 1 }] });
  expect((await m.reservar(json("POST", "evidencias/reservas", { archivos: [{ bytes: 10, contentType: "image/jpeg" }] }), inv)).status).toBe(201);
  expect((await m.reservar(json("POST", "evidencias/reservas", { archivos: [{ bytes: 10, contentType: "image/jpeg" }], extra: 1 }), inv)).status).toBe(422);
});

test("RF-402: la subida entrega el binario, el orden y el tipo al servicio", async () => {
  como("familia");
  (subirArchivo as jest.Mock).mockResolvedValue({ orden: 2, bytes: 4 });
  const req = new HttpRequest({ method: "PUT", url: `https://sigecat.example/v1/evidencias/${id}/archivos/2`, headers: { "content-type": "image/jpeg" }, params: { evidenciaId: id, orden: "2" }, body: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) } });
  const r = await m.subir(req, inv);
  expect(r.status).toBe(200);
  const [, evidenciaId, orden, contenido, tipo] = (subirArchivo as jest.Mock).mock.calls[0];
  expect([evidenciaId, orden, tipo]).toEqual([id, 2, "image/jpeg"]);
  expect([...contenido]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
});

test("RF-402: un identificador de evidencia que no es UUID responde 404", async () => {
  como("familia");
  const req = new HttpRequest({ method: "PUT", url: "https://sigecat.example/v1/evidencias/x/archivos/1", params: { evidenciaId: "x", orden: "1" }, body: { bytes: new Uint8Array([1]) } });
  expect((await m.subir(req, inv)).status).toBe(404);
});

test("RF-403: un lote válido responde 201 y uno con causa vacía o sin ausencias responde 422", async () => {
  como("familia");
  (crearLote as jest.Mock).mockResolvedValue({ loteId: id, justificaciones: [] });
  const base = { loteId: id, causa: "salud_nino", evidenciaId: id, ausencias: [{ catequizandoId: id, sesionId: id, justificacionId: id }] };
  expect((await m.crearLote(json("POST", "justificaciones/lotes", base), inv)).status).toBe(201);
  expect((await m.crearLote(json("POST", "justificaciones/lotes", { ...base, ausencias: [] }), inv)).status).toBe(422);
  expect((await m.crearLote(json("POST", "justificaciones/lotes", { ...base, causa: "" }), inv)).status).toBe(422);
});

test("RF-408: la bandeja solo la ven coordinación y supervisión; el catequista recibe 403", async () => {
  (consultarBandeja as jest.Mock).mockResolvedValue({ lotes: [] });
  for (const rol of ["coordinacion", "supervision"] as const) {
    como(rol);
    expect((await m.bandeja(json("GET", "justificaciones/bandeja"), inv)).status).toBe(200);
  }
  como("catequista");
  expect((await m.bandeja(json("GET", "justificaciones/bandeja"), inv)).status).toBe(403);
  como("familia");
  expect((await m.bandeja(json("GET", "justificaciones/bandeja"), inv)).status).toBe(403);
});

test("RF-406: solo la coordinación revisa y supervisión recibe 403", async () => {
  (revisarJustificaciones as jest.Mock).mockResolvedValue({ revisadas: [] });
  const cuerpo = { justificacionIds: [id], decision: "aprobada" };
  como("coordinacion");
  expect((await m.revisar(json("POST", "justificaciones/revisiones", cuerpo), inv)).status).toBe(200);
  expect((await m.revisar(json("POST", "justificaciones/revisiones", { ...cuerpo, decision: "quizas" }), inv)).status).toBe(422);
  como("supervision");
  expect((await m.revisar(json("POST", "justificaciones/revisiones", cuerpo), inv)).status).toBe(403);
});

test("RNF-403: la evidencia responde con URL temporal sin caché y un id inválido responde 404", async () => {
  como("coordinacion");
  (obtenerLecturaEvidencia as jest.Mock).mockResolvedValue({ url: "https://almacen/x", urls: ["https://almacen/x"], expiraEn: "2026-11-12T20:00:00.000Z" });
  const ok = await m.evidencia(new HttpRequest({ method: "GET", url: "https://sigecat.example/v1/x", params: { id } }), inv);
  expect(ok).toMatchObject({ status: 200, headers: { "Cache-Control": "no-store" } });
  expect((await m.evidencia(new HttpRequest({ method: "GET", url: "https://sigecat.example/v1/x", params: { id: "no-uuid" } }), inv)).status).toBe(404);
});
