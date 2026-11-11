import { HttpRequest, type InvocationContext } from "@azure/functions";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { autenticarPeticion, auditar } from "../../../src/modulos/seguridad";
import { limitarPorCuenta } from "../../../src/compartido/http/limites";
import { manejadoresAsistente } from "../../../src/modulos/asistente/http";

jest.mock("../../../src/modulos/seguridad", () => ({ autenticarPeticion: jest.fn(), auditar: jest.fn() }));
jest.mock("../../../src/compartido/http/limites", () => ({ limitarPorCuenta: jest.fn() }));

const id = "00200000-0000-4000-8000-000000000001";
const invocacion = {} as InvocationContext;
const contexto: ContextoAcceso = {
  cuentaId: id,
  credencialId: id,
  rolesPropios: ["catequista"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Catequista demo",
  esMenor: false,
};
const peticion = (pregunta: string) =>
  new HttpRequest({
    method: "POST",
    url: "https://sigecat.example/v1/asistente/preguntar",
    headers: { "content-type": "application/json" },
    body: { string: JSON.stringify({ pregunta }) },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auditar).mockResolvedValue();
  jest.mocked(limitarPorCuenta).mockResolvedValue();
  jest.mocked(autenticarPeticion).mockResolvedValue(contexto);
});

test("RF-1002 RF-1003 RF-1006: el flujo real responde con cita del corpus y sin datos personales", async () => {
  const r = await manejadoresAsistente.preguntar(peticion("¿Qué es la Eucaristía?"), invocacion);
  expect(r.status).toBe(200);
  const cuerpo = r.jsonBody as { respuesta: string; fuentes: { id: string }[]; proveedor: string };
  expect(cuerpo.respuesta).toContain("[Sagrada Escritura, Eucaristía (1 Corintios 11:23-26)]");
  expect(cuerpo.fuentes.map((fuente) => fuente.id)).toEqual(["eucaristia"]);
  expect(cuerpo.proveedor).toBe("extractivo");
  expect(auditar).not.toHaveBeenCalled();
});

test("RF-1003: el flujo real se abstiene cuando el corpus no sustenta la pregunta", async () => {
  const r = await manejadoresAsistente.preguntar(peticion("¿Qué es un dinosaurio?"), invocacion);
  expect(r.status).toBe(200);
  const cuerpo = r.jsonBody as { respuesta: string; fuentes: unknown[]; modelo: string };
  expect(cuerpo.respuesta).toContain("No encontré sustento");
  expect(cuerpo.fuentes).toEqual([]);
  expect(cuerpo.modelo).toBe("abstencion");
});

test("RF-1004: el flujo real rechaza una pregunta sobre la salud de un menor", async () => {
  const r = await manejadoresAsistente.preguntar(peticion("¿Cuál es la salud de mi hijo?"), invocacion);
  expect(r.status).toBe(200);
  const cuerpo = r.jsonBody as { respuesta: string; fuentes: unknown[]; proveedor: string };
  expect(cuerpo.respuesta).toContain("No puedo consultar datos de niños");
  expect(cuerpo.fuentes).toEqual([]);
  expect(cuerpo.proveedor).toBe("guardia");
});
