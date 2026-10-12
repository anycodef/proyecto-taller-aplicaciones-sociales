import { HttpRequest, InvocationContext } from "@azure/functions";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { conAcceso } from "../../../src/compartido/http/con-acceso";
import { autenticarPeticion, auditar } from "../../../src/modulos/seguridad";
jest.mock("../../../src/modulos/seguridad", () => ({ autenticarPeticion: jest.fn(), auditar: jest.fn() }));
const ctx: ContextoAcceso = { cuentaId: "cuenta", credencialId: "credencial", identidadOperativa: "Luz 3", esMenor: true, rolesPropios: ["catequista"], gruposAsignados: ["propio"], catequizandosApoderados: [] };
const req = new HttpRequest({ method: "GET", url: "https://api.test/api/condiciones" });
const inv = new InvocationContext({ functionName: "sonda" });
beforeEach(() => { jest.clearAllMocks(); jest.mocked(autenticarPeticion).mockResolvedValue(ctx); jest.mocked(auditar).mockResolvedValue(); });
test("RF-102 RF-109: denegación fuera de grupo audita antes de responder y no consulta dato", async () => {
  const manejador = jest.fn(async () => ({ jsonBody: { salud: "restringido" } }));
  const resultado = await conAcceso({ accion: "restringido:leer", recurso: async () => ({ grupoId: "ajeno" }) }, manejador)(req, inv);
  expect(resultado).toMatchObject({ status: 403, jsonBody: { codigo: "fuera_de_alcance" } });
  expect(auditar).toHaveBeenCalledWith(ctx, expect.objectContaining({ accion: "restringido:leer", resultado: "denegado" }));
  expect(manejador).not.toHaveBeenCalled();
});
test("RF-109 RNF-101: fallo de auditoría de denegación impide respuesta con datos", async () => {
  jest.mocked(auditar).mockRejectedValue(new Error("fallo-auditoria"));
  const manejador = jest.fn(async () => ({ jsonBody: { salud: "restringido" } }));
  const resultado = await conAcceso({ accion: "restringido:leer", recurso: async () => ({ grupoId: "ajeno" }) }, manejador)(req, inv);
  expect(resultado).toMatchObject({ status: 500, jsonBody: { codigo: "error_interno" } });
  expect(manejador).not.toHaveBeenCalled();
});
test("RF-109: lectura permitida que exige auditoría falla si no se registra", async () => {
  jest.mocked(auditar).mockRejectedValue(new Error("fallo-auditoria"));
  const resultado = await conAcceso({ accion: "restringido:leer", recurso: async () => ({ grupoId: "propio" }) }, async (_req, contexto) => {
    await auditar(contexto, { accion: "restringido:leer", resultado: "permitido" });
    return { jsonBody: { salud: "restringido" } };
  })(req, inv);
  expect(resultado).toMatchObject({ status: 500, jsonBody: { codigo: "error_interno" } });
});
