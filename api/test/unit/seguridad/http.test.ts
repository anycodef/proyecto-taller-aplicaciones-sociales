import { HttpRequest } from "@azure/functions";
import { manejarAcceso, registrarSeguridad } from "../../../src/modulos/seguridad/http/index";
import { registrarAvisos } from "../../../src/modulos/avisos/http/index";
import { entrar, renovar } from "../../../src/modulos/seguridad/aplicacion/acceso";
import { ErrorAplicacion } from "../../../src/compartido/http/respuestas";
const mockHttp = jest.fn(), mockTimer = jest.fn();
jest.mock("@azure/functions", () => ({ ...jest.requireActual<typeof import("@azure/functions")>("@azure/functions"), app: { http: (...args: unknown[]) => mockHttp(...args), timer: (...args: unknown[]) => mockTimer(...args) } }));
jest.mock("../../../src/modulos/seguridad/aplicacion/acceso", () => ({ entrar: jest.fn(), renovar: jest.fn(), reportarBloqueo: jest.fn() }));
function peticion(ruta: string, cuerpo: unknown) { return new HttpRequest({ url: `https://api.test/api/acceso/${ruta}`, method: "POST", body: { string: JSON.stringify(cuerpo) }, headers: { "content-type": "application/json" } }); }
const dispositivoId = "10000000-0000-4000-8000-000000000003";
beforeEach(() => { jest.clearAllMocks(); });
test("RF-111 RF-107: PIN, pinHash y campos ajenos nunca llegan al servicio de acceso", async () => {
  for (const campo of ["pin", "pinHash", "contrasena", "roles"]) {
    const respuesta = await manejarAcceso(peticion("equipo/activar", { token: "t".repeat(43), dispositivoId, [campo]: "1234" }));
    expect(respuesta.status).toBe(422);
  }
  expect(entrar).not.toHaveBeenCalled();
});
test("RF-101: acceso inexistente, revocado y celular distinto tienen respuesta idéntica", async () => {
  jest.mocked(entrar).mockRejectedValue(new ErrorAplicacion(401, "acceso_denegado"));
  for (const token of ["a", "b", "c"]) {
    expect(await manejarAcceso(peticion("equipo/activar", { token: token.repeat(43), dispositivoId }))).toEqual({ status: 401, jsonBody: { codigo: "acceso_denegado" }, headers: { "Cache-Control": "no-store" } });
  }
});
test("RF-112: renovación conserva error conocido, rechaza contador inválido y no devuelve errores internos", async () => {
  jest.mocked(renovar).mockRejectedValue(new ErrorAplicacion(401, "credencial_terminada"));
  expect((await manejarAcceso(peticion("renovar", { tokenRenovacion: "t".repeat(43), dispositivoId, pendientes: 3 }))).jsonBody).toEqual({ codigo: "credencial_terminada" });
  expect((await manejarAcceso(peticion("renovar", { tokenRenovacion: "t".repeat(43), dispositivoId, pendientes: -1 }))).status).toBe(422);
  jest.mocked(renovar).mockRejectedValue(new Error("secreto-diagnostico"));
  expect((await manejarAcceso(peticion("renovar", { tokenRenovacion: "t".repeat(43), dispositivoId }))).jsonBody).toEqual({ codigo: "error_interno" });
});
test("RF-101 RNF-103: todas las Functions HTTP incluso canje exigen clave de host", () => {
  registrarSeguridad(); registrarAvisos();
  expect(mockHttp).toHaveBeenCalledTimes(24);
  for (const llamada of mockHttp.mock.calls) expect(llamada[1]).toMatchObject({ authLevel: "function" });
});
test("RF-108 RF-109: temporizadores registrados con cron UTC del plan", () => {
  registrarSeguridad();
  expect(mockTimer.mock.calls.map(([nombre, opciones]) => [nombre, opciones.schedule])).toEqual([["retencionDiaria", "0 0 8 * * *"], ["borradosPendientes", "0 */15 * * * *"], ["purgaAuditoria", "0 0 9 1 * *"]]);
});
