import { HttpRequest, type InvocationContext } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { autenticarPeticion, auditar } from "../../../src/modulos/seguridad";
import { limitarPorCuenta } from "../../../src/compartido/http/limites";
import { ErrorAplicacion } from "../../../src/compartido/http/respuestas";
import { registrarMetricasAsistente } from "../../../src/modulos/asistente/aplicacion/metricas";
import { preguntarAsistente } from "../../../src/modulos/asistente/aplicacion/preguntar";
import { manejadoresAsistente } from "../../../src/modulos/asistente/http";

jest.mock("../../../src/modulos/seguridad", () => ({ autenticarPeticion: jest.fn(), auditar: jest.fn() }));
jest.mock("../../../src/compartido/http/limites", () => ({ limitarPorCuenta: jest.fn() }));
jest.mock("../../../src/modulos/asistente/aplicacion/metricas", () => ({ registrarMetricasAsistente: jest.fn() }));
jest.mock("../../../src/modulos/asistente/aplicacion/preguntar", () => ({ preguntarAsistente: jest.fn() }));

const id = "00200000-0000-4000-8000-000000000001";
const invocacion = {} as InvocationContext;
const contexto = (...rolesPropios: Rol[]): ContextoAcceso => ({
  cuentaId: id,
  credencialId: id,
  rolesPropios,
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Cuenta demo",
  esMenor: false,
});
const peticion = (cuerpo: unknown = { pregunta: "¿Qué es la Eucaristía?" }) =>
  new HttpRequest({
    method: "POST",
    url: "https://sigecat.example/v1/asistente/preguntar",
    headers: { "content-type": "application/json" },
    body: { string: JSON.stringify(cuerpo) },
  });
const respuesta = {
  respuesta: "La Eucaristía es el sacramento del cuerpo y la sangre de Cristo [Documento, Eucaristía].",
  fuentes: [
    {
      id: "eucaristia",
      documento: "Documento",
      seccion: "Eucaristía",
      fuente: "https://example.org/fuente",
      licencia: "Dominio público",
    },
  ],
  proveedor: "extractivo",
  modelo: "extractivo-1",
  versionCorpus: "v1",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auditar).mockResolvedValue();
  jest.mocked(limitarPorCuenta).mockResolvedValue();
  jest.mocked(preguntarAsistente).mockResolvedValue(respuesta);
  jest.mocked(registrarMetricasAsistente).mockResolvedValue();
  jest.mocked(autenticarPeticion).mockResolvedValue(contexto("coordinacion"));
});

test("RF-1001: sin sesión el asistente responde 401 sin consumir cuota ni consultar", async () => {
  jest.mocked(autenticarPeticion).mockResolvedValue(null);
  const r = await manejadoresAsistente.preguntar(peticion(), invocacion);
  expect(r.status).toBe(401);
  expect(r.jsonBody).toEqual({ codigo: "acceso_denegado" });
  expect(limitarPorCuenta).not.toHaveBeenCalled();
  expect(preguntarAsistente).not.toHaveBeenCalled();
});

test("RF-1001 RF-1008: todos los roles autenticados consultan con no-store, cuota y sin datos personales", async () => {
  for (const rol of ["administracion", "coordinacion", "catequista", "familia", "supervision"] as Rol[]) {
    jest.mocked(autenticarPeticion).mockResolvedValue(contexto(rol));
    const r = await manejadoresAsistente.preguntar(peticion(), invocacion);
    expect(r.status).toBe(200);
    expect(r.headers).toEqual({ "Cache-Control": "no-store" });
    expect(r.jsonBody).toEqual(respuesta);
  }
  expect(limitarPorCuenta).toHaveBeenCalledWith(id, "asistente:preguntar", 20, 3600);
  expect(preguntarAsistente).toHaveBeenCalledWith("¿Qué es la Eucaristía?");
  await Promise.resolve();
  expect(registrarMetricasAsistente).toHaveBeenCalledWith(id, respuesta, expect.any(Number));
});

test("RF-1001 RNF-1004: el cuerpo inválido responde 422 sin consultar ni guardar", async () => {
  for (const cuerpo of [{}, { pregunta: "  " }, { pregunta: "abc", extra: true }, { pregunta: "x".repeat(501) }]) {
    const r = await manejadoresAsistente.preguntar(peticion(cuerpo), invocacion);
    expect(r.status).toBe(422);
    expect(r.jsonBody).toEqual({ codigo: "entrada_invalida" });
  }
  expect(preguntarAsistente).not.toHaveBeenCalled();
});

test("RF-1005: la consulta 21 de la hora responde 429 sin consultar el asistente", async () => {
  let llamadas = 0;
  jest.mocked(limitarPorCuenta).mockImplementation(async () => {
    llamadas += 1;
    if (llamadas > 20) throw new ErrorAplicacion(429, "limite_excedido");
  });

  for (let indice = 1; indice <= 20; indice += 1) {
    const r = await manejadoresAsistente.preguntar(peticion(), invocacion);
    expect(r.status).toBe(200);
  }

  const r = await manejadoresAsistente.preguntar(peticion(), invocacion);
  expect(r.status).toBe(429);
  expect(r.jsonBody).toEqual({ codigo: "limite_excedido" });
  expect(preguntarAsistente).toHaveBeenCalledTimes(20);
});

test("RNF-1004 RF-1008: la cuota agotada responde 429 sin consultar el asistente", async () => {
  jest.mocked(limitarPorCuenta).mockRejectedValue(new ErrorAplicacion(429, "limite_excedido"));
  const r = await manejadoresAsistente.preguntar(peticion(), invocacion);
  expect(r.status).toBe(429);
  expect(r.jsonBody).toEqual({ codigo: "limite_excedido" });
  expect(preguntarAsistente).not.toHaveBeenCalled();
});

test("RF-1006: la consulta permitida no audita ni escribe la pregunta en consola", async () => {
  const log = jest.spyOn(console, "log").mockImplementation();
  const info = jest.spyOn(console, "info").mockImplementation();
  const error = jest.spyOn(console, "error").mockImplementation();
  try {
    await manejadoresAsistente.preguntar(peticion(), invocacion);
    const escritos = [...log.mock.calls, ...info.mock.calls, ...error.mock.calls].map((args) => args.join(" ")).join(" ");
    expect(escritos).not.toContain("Eucaristía");
    expect(auditar).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
    info.mockRestore();
    error.mockRestore();
  }
});

test("RNF-1004: un fallo inesperado responde 500 sin exponer detalles internos", async () => {
  jest.mocked(preguntarAsistente).mockRejectedValue(new Error("detalle interno"));
  const r = await manejadoresAsistente.preguntar(peticion(), invocacion);
  expect(r.status).toBe(500);
  expect(r.jsonBody).toEqual({ codigo: "error_interno" });
});

test("RF-1004 RF-1008: «¿Cuántas faltas tiene Juan?» responde 200 con proveedor guardia y sin fuentes", async () => {
  jest.mocked(preguntarAsistente).mockImplementationOnce(jest.requireActual("../../../src/modulos/asistente/aplicacion/preguntar").preguntarAsistente);
  const r = await manejadoresAsistente.preguntar(peticion({ pregunta: "¿Cuántas faltas tiene Juan?" }), invocacion);
  expect(r.status).toBe(200);
  expect(r.jsonBody).toMatchObject({ proveedor: "guardia", modelo: "filtro", fuentes: [] });
});
