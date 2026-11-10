import { HttpRequest, InvocationContext } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { manejadoresAsistencia } from "../../../src/modulos/asistencia/http";
import { manejadoresSincronizacion } from "../../../src/modulos/sincronizacion/http";
import { aplicarPull } from "../../../src/modulos/sincronizacion/aplicacion/pull";
import { aplicarPush } from "../../../src/modulos/sincronizacion/aplicacion/push";
import { esquemaPush } from "../../../src/modulos/sincronizacion/dominio/validacion";
import { autenticarPeticion, auditar } from "../../../src/modulos/seguridad";
import { recursoCatequizando } from "../../../src/compartido/http/recursos";
import { consultarResumenAsistencia } from "../../../src/modulos/asistencia/aplicacion/consultar-faltas";
import { reporteMisa } from "../../../src/modulos/asistencia/aplicacion/reporte-misa";
import { conAcceso } from "../../../src/compartido/http/con-acceso";
import type { Tx } from "../../../src/compartido/bd/transaccion";

jest.mock("../../../src/modulos/seguridad", () => ({ autenticarPeticion: jest.fn(), auditar: jest.fn() }));
jest.mock("../../../src/compartido/http/recursos", () => ({ recursoCatequizando: jest.fn() }));
jest.mock("../../../src/compartido/http/limites", () => ({ limitarPorCuenta: jest.fn() }));
jest.mock("../../../src/modulos/asistencia/aplicacion/consultar-faltas", () => ({ consultarResumenAsistencia: jest.fn() }));
jest.mock("../../../src/modulos/asistencia/aplicacion/reporte-misa", () => ({ reporteMisa: jest.fn() }));

const hijo = "10000000-0000-4000-8000-000000000001";
const ajeno = "10000000-0000-4000-8000-000000000002";
const ciclo = "10000000-0000-4000-8000-000000000003";
const base: ContextoAcceso = { cuentaId: "cuenta", credencialId: "credencial", dispositivoId: "dispositivo", identidadOperativa: "Luz", esMenor: true, rolesPropios: ["catequista", "familia"], gruposAsignados: ["propio"], catequizandosApoderados: [hijo] };
const inv = new InvocationContext({ functionName: "autorizacion" });
function autenticar(rolesPropios: Rol[]) { jest.mocked(autenticarPeticion).mockResolvedValue({ ...base, rolesPropios }); }
function peticion(id = ajeno, method = "GET") {
  return new HttpRequest({ method, url: `https://api.test/api/asistencia/catequizandos/${id}/domingos?cicloId=${ciclo}`, params: { id, fecha: "2020-10-04" } });
}
beforeEach(() => {
  jest.clearAllMocks();
  autenticar(base.rolesPropios);
  jest.mocked(auditar).mockResolvedValue();
  jest.mocked(recursoCatequizando).mockImplementation(async catequizandoId => ({ catequizandoId, grupoId: "ajeno" }));
  jest.mocked(consultarResumenAsistencia).mockResolvedValue({ domingos: [], ausencias: 0, faltas: 0 });
});

test("RF-102 RF-311: domingos preserva la unión catequista y familia sin leer un tercero", async () => {
  expect((await manejadoresAsistencia.domingos(peticion(hijo), inv)).status).toBe(200);
  jest.mocked(recursoCatequizando).mockResolvedValueOnce({ catequizandoId: ajeno, grupoId: "propio" });
  expect((await manejadoresAsistencia.domingos(peticion(), inv)).status).toBe(200);
  jest.mocked(consultarResumenAsistencia).mockClear();
  expect((await manejadoresAsistencia.domingos(peticion(), inv)).status).toBe(403);
  expect(consultarResumenAsistencia).not.toHaveBeenCalled();
  expect(auditar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ resultado: "denegado", catequizandoId: ajeno }));
});

test("RF-102 RF-312: supervisión lee asistencia y reporte pero no atiende avisos ni sincroniza escrituras", async () => {
  autenticar(["supervision"]);
  expect((await manejadoresAsistencia.domingos(peticion(), inv)).status).toBe(200);
  expect((await manejadoresAsistencia.reporteMisa(peticion(), inv)).status).toBe(200);
  expect(reporteMisa).toHaveBeenCalledWith("2020-10-04");
  expect((await manejadoresAsistencia.atenderAviso(peticion(ajeno, "POST"), inv)).status).toBe(403);
  expect((await manejadoresSincronizacion.push(peticion(ajeno, "POST"), inv)).status).toBe(403);
  expect((await manejadoresSincronizacion.pull(peticion(), inv)).status).toBe(403);
});

test.each<Rol>(["familia", "catequista", "administracion"])("RF-312: el rol %s no obtiene el reporte global", async rol => {
  autenticar([rol]);
  expect((await manejadoresAsistencia.reporteMisa(peticion(), inv)).status).toBe(403);
  expect(reporteMisa).not.toHaveBeenCalled();
});

test("RF-102: supervisión no anula los permisos de escritura concedidos por otro rol", async () => {
  autenticar(["supervision", "catequista"]);
  const operacion = jest.fn(async () => ({ status: 200 }));
  expect((await conAcceso({ accion: "asistencia:pasar-lista", recurso: async () => ({ grupoId: "ajeno" }) }, operacion)(peticion(), inv)).status).toBe(200);
  expect(operacion).toHaveBeenCalledTimes(1);
});

test("RF-102 RF-410: middleware de estado y evidencia conserva alcances distintos para una cuenta catequista y familia", async () => {
  const operacion = jest.fn(async () => ({ status: 200 }));
  for (const [accion, recurso, estado] of [
    ["justificacion:leer", { catequizandoId: hijo, grupoId: "ajeno" }, 200],
    ["justificacion:leer", { catequizandoId: ajeno, grupoId: "propio" }, 200],
    ["justificacion:leer", { catequizandoId: ajeno, grupoId: "ajeno" }, 403],
    ["evidencia:leer", { catequizandoId: hijo, grupoId: "ajeno" }, 403],
    ["evidencia:leer", { catequizandoId: ajeno, grupoId: "propio" }, 200],
  ] as const) {
    expect((await conAcceso({ accion, recurso: async () => recurso }, operacion)(peticion(), inv)).status).toBe(estado);
  }
  autenticar(["supervision"]);
  expect((await conAcceso({ accion: "evidencia:leer", recurso: async () => ({ catequizandoId: ajeno, grupoId: "ajeno" }) }, operacion)(peticion(), inv)).status).toBe(200);
});

test.each<Rol>(["familia", "supervision", "administracion"])("RF-102 RF-307: aplicarPull y aplicarPush rechazan %s antes de consultar datos", async rol => {
  const query = jest.fn();
  const tx = { query } as unknown as Tx;
  const cuenta = { ...base, rolesPropios: [rol] };
  await expect(aplicarPull({ ultimoPulso: null, versionEsquema: 1 }, cuenta, tx)).rejects.toMatchObject({ estado: 403 });
  await expect(aplicarPush({ changes: {} }, cuenta, tx)).rejects.toMatchObject({ estado: 403 });
  expect(query).not.toHaveBeenCalled();
});

test.each(["justificaciones", "justificaciones_estado", "contactos_riesgo", "fichas_compromiso", "retiros_riesgo", "estados_riesgo", "alertas_riesgo"])("RF-408 RF-707: la colección no implementada %s no se acepta mediante el push de 003", tabla => {
  expect(esquemaPush.safeParse({ changes: { [tabla]: { created: [], updated: [], deleted: [] } } }).success).toBe(false);
});
