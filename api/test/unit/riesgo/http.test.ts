import { HttpRequest, type InvocationContext } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { autenticarPeticion, auditar } from "../../../src/modulos/seguridad";
import { limitarPorCuenta } from "../../../src/compartido/http/limites";
import { ErrorAplicacion } from "../../../src/compartido/http/respuestas";
import { consultarListaRiesgo } from "../../../src/modulos/riesgo/aplicacion/consultar-lista-riesgo";
import { manejadoresRiesgo } from "../../../src/modulos/riesgo/http";

jest.mock("../../../src/modulos/seguridad", () => ({ autenticarPeticion: jest.fn(), auditar: jest.fn() }));
jest.mock("../../../src/compartido/http/limites", () => ({ limitarPorCuenta: jest.fn() }));
jest.mock("../../../src/compartido/bd/transaccion", () => ({
  enTransaccion: (operacion: (tx: unknown) => Promise<unknown>) => operacion({}),
}));
jest.mock("../../../src/modulos/riesgo/aplicacion/consultar-lista-riesgo", () => ({ consultarListaRiesgo: jest.fn() }));

const id = "00200000-0000-4000-8000-000000000001";
const grupoId = "00200000-0000-4000-8000-000000000002";
const invocacion = {} as InvocationContext;
const contexto = (...rolesPropios: Rol[]): ContextoAcceso => ({
  cuentaId: id,
  credencialId: id,
  rolesPropios,
  gruposAsignados: [grupoId],
  catequizandosApoderados: [],
  identidadOperativa: "Coordinación demo",
  esMenor: false,
});
const peticion = () => new HttpRequest({ method: "GET", url: "https://sigecat.example/v1/riesgo" });
const lista = [
  {
    catequizandoId: id,
    nombre: "Niño ficticio",
    grupoId,
    grupoNombre: "Grupo demo",
    paso: "contacto" as const,
    conteo: 2,
    sinFicha: true,
    pendientesJustificar: 0,
    faltasOrigen: [],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auditar).mockResolvedValue();
  jest.mocked(limitarPorCuenta).mockResolvedValue();
  jest.mocked(consultarListaRiesgo).mockResolvedValue(lista);
  jest.mocked(autenticarPeticion).mockResolvedValue(contexto("coordinacion"));
});

test("RF-707: sin sesión la lista de riesgo responde 401 sin consultar", async () => {
  jest.mocked(autenticarPeticion).mockResolvedValue(null);
  const r = await manejadoresRiesgo.listar(peticion(), invocacion);
  expect(r.status).toBe(401);
  expect(r.jsonBody).toEqual({ codigo: "acceso_denegado" });
  expect(consultarListaRiesgo).not.toHaveBeenCalled();
});

test("RF-707: familia y supervisión no acceden a la lista de riesgo", async () => {
  for (const rol of ["familia", "supervision"] as Rol[]) {
    jest.mocked(autenticarPeticion).mockResolvedValue(contexto(rol));
    const r = await manejadoresRiesgo.listar(peticion(), invocacion);
    expect(r.status).toBe(403);
    expect(r.jsonBody).toEqual({ codigo: "fuera_de_alcance" });
  }
  expect(consultarListaRiesgo).not.toHaveBeenCalled();
  expect(auditar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ resultado: "denegado" }));
});

test("RF-707: coordinación y catequista leen la lista con no-store y cuota", async () => {
  for (const rol of ["coordinacion", "catequista"] as Rol[]) {
    jest.mocked(autenticarPeticion).mockResolvedValue(contexto(rol));
    const r = await manejadoresRiesgo.listar(peticion(), invocacion);
    expect(r.status).toBe(200);
    expect(r.headers).toEqual({ "Cache-Control": "no-store" });
    expect(r.jsonBody).toEqual(lista);
  }
  expect(limitarPorCuenta).toHaveBeenCalledWith(id, "riesgo:listar", 60, 60);
  expect(consultarListaRiesgo).toHaveBeenCalledWith(expect.anything(), expect.any(Date), {});
});

test("RF-707: la cuota agotada responde 429 sin leer riesgo", async () => {
  jest.mocked(limitarPorCuenta).mockRejectedValue(new ErrorAplicacion(429, "limite_excedido"));
  const r = await manejadoresRiesgo.listar(peticion(), invocacion);
  expect(r.status).toBe(429);
  expect(r.jsonBody).toEqual({ codigo: "limite_excedido" });
  expect(consultarListaRiesgo).not.toHaveBeenCalled();
});
