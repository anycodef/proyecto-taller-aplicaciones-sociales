import { app, HttpRequest, InvocationContext, type HttpFunctionOptions } from "@azure/functions";
import { obtenerPool } from "../../../src/compartido/bd/pool";
import { manejarEstado, registrarEstado } from "../../../src/compartido/http/estado";

jest.mock("@azure/functions", () => ({ ...jest.requireActual<typeof import("@azure/functions")>("@azure/functions"), app: { http: jest.fn() } }));
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: jest.fn() }));

const consulta = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(obtenerPool).mockReturnValue({ query: consulta } as unknown as ReturnType<typeof obtenerPool>);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test("RNF-106: PostgreSQL sano devuelve solo disponible y no-store con SELECT 1 acotado", async () => {
  consulta.mockResolvedValue({ rows: [{ secreto: "resultado-no-publicable" }], rowCount: 1 });
  expect(await manejarEstado()).toEqual({ status: 200, jsonBody: { estado: "disponible" }, headers: { "Cache-Control": "no-store" } });
  expect(obtenerPool).toHaveBeenCalledTimes(1);
  expect(consulta).toHaveBeenCalledTimes(1);
  expect(consulta).toHaveBeenCalledWith({ text: "SELECT 1", query_timeout: 5000 });
});

test("RNF-106: fallo de consulta devuelve solo no_disponible y no-store", async () => {
  consulta.mockRejectedValue(new Error("postgres://usuario:clave@servidor/base datos-personales"));
  expect(await manejarEstado()).toEqual({ status: 503, jsonBody: { estado: "no_disponible" }, headers: { "Cache-Control": "no-store" } });
});

test("RNF-106: fallo al obtener el pool también se sanitiza sin consultar", async () => {
  jest.mocked(obtenerPool).mockImplementation(() => { throw new Error("BD_URL privada"); });
  expect(await manejarEstado()).toEqual({ status: 503, jsonBody: { estado: "no_disponible" }, headers: { "Cache-Control": "no-store" } });
  expect(consulta).not.toHaveBeenCalled();
});

test("RNF-106: vencimiento del query_timeout configurado produce 503", async () => {
  jest.useFakeTimers();
  consulta.mockImplementation(({ query_timeout }: { query_timeout: number }) => new Promise((_, rechazar) => {
    setTimeout(() => rechazar(new Error("Query read timeout")), query_timeout);
  }));
  const respuesta = manejarEstado();
  await jest.advanceTimersByTimeAsync(5000);
  expect(await respuesta).toEqual({ status: 503, jsonBody: { estado: "no_disponible" }, headers: { "Cache-Control": "no-store" } });
  expect(jest.getTimerCount()).toBe(0);
});

test("RNF-106 RF-101: registro GET estado idempotente exige clave de host sin acceso personal ni logs", async () => {
  const registros = ["debug", "info", "log", "warn", "error", "trace"] as const;
  const logs = registros.map(nombre => jest.spyOn(console, nombre).mockImplementation(() => {}));
  const contexto = new InvocationContext();
  const logsContexto = registros.map(nombre => jest.spyOn(contexto, nombre).mockImplementation(() => {}));
  registrarEstado(); registrarEstado();
  expect(app.http).toHaveBeenCalledTimes(1);
  const [nombre, opciones] = jest.mocked(app.http).mock.calls[0] as [string, HttpFunctionOptions];
  expect(nombre).toBe("estado");
  expect(opciones).toEqual({ methods: ["GET"], authLevel: "function", route: "estado", handler: manejarEstado });
  const peticion = new HttpRequest({ method: "GET", url: "https://origen.test/api/estado" });
  consulta.mockResolvedValue({ rows: [{ secreto: "no-publicar" }] });
  expect(await opciones.handler(peticion, contexto)).toEqual({ status: 200, jsonBody: { estado: "disponible" }, headers: { "Cache-Control": "no-store" } });
  const fallo = Object.defineProperty({}, "message", { get: () => { throw new Error("No leer detalles"); } });
  consulta.mockRejectedValue(fallo);
  expect(await opciones.handler(peticion, contexto)).toEqual({ status: 503, jsonBody: { estado: "no_disponible" }, headers: { "Cache-Control": "no-store" } });
  for (const log of [...logs, ...logsContexto]) expect(log).not.toHaveBeenCalled();
});
