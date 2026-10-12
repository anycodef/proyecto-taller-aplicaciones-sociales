import { HttpRequest, InvocationContext } from "@azure/functions";
import { autenticarPeticion } from "../../../src/modulos/seguridad/aplicacion/contexto";
import { firmarJwt } from "../../../src/modulos/seguridad/infraestructura/firmador-jwt";
import { consultar } from "../../../src/compartido/bd/pool";
import { conAcceso } from "../../../src/compartido/http/con-acceso";
import type { QueryResult, QueryResultRow } from "pg";
jest.mock("../../../src/compartido/bd/pool", () => ({ consultar: jest.fn() }));
const identidad = { cuentaId: "10000000-0000-4000-8000-000000000001", credencialId: "10000000-0000-4000-8000-000000000002", dispositivoId: "10000000-0000-4000-8000-000000000003", tipo: "equipo" as const };
const fila = { cuenta_id: identidad.cuentaId, credencial_id: identidad.credencialId, dispositivo_id: identidad.dispositivoId, identidad_operativa: "Luz 3", es_menor: true, roles: ["catequista"], delegacion: null, grupos: ["grupo"], hijos: [] };
function resultado(rows: QueryResultRow[]): QueryResult<QueryResultRow> { return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] }; }
const peticion = (jwt?: string) => new HttpRequest({ method: "GET", url: "https://api.test/api/yo", headers: jwt ? { authorization: `Bearer ${jwt}` } : {} });
let entorno: NodeJS.ProcessEnv;
beforeEach(() => { entorno = { ...process.env }; process.env.JWT_CLAVE = "j".repeat(32); delete process.env.JWT_CLAVES; process.env.JWT_KID = "prueba"; jest.clearAllMocks(); });
afterEach(() => { process.env = entorno; });
test("RF-101: cabecera ausente o firma inválida no consulta BD ni expone contexto", async () => {
  expect(await autenticarPeticion(peticion())).toBeNull();
  expect(await autenticarPeticion(peticion("invalido"))).toBeNull();
  expect(consultar).not.toHaveBeenCalled();
});
test("RF-101 RF-102: cada petición recarga roles y alcance, sin confiar en JWT ni caché", async () => {
  const jwt = await firmarJwt(identidad);
  jest.mocked(consultar).mockResolvedValueOnce(resultado([fila]))
    .mockResolvedValueOnce(resultado([{ ...fila, roles: ["catequista", "familia"], grupos: [], hijos: ["hijo"] }]))
    .mockResolvedValueOnce(resultado([]));
  expect((await autenticarPeticion(peticion(jwt)))?.rolesPropios).toEqual(["catequista"]);
  expect((await autenticarPeticion(peticion(jwt)))?.catequizandosApoderados).toEqual(["hijo"]);
  expect(await autenticarPeticion(peticion(jwt))).toBeNull();
  expect(consultar).toHaveBeenCalledTimes(3);
  expect(jest.mocked(consultar).mock.calls[0]?.[1]).toEqual([identidad.cuentaId, identidad.credencialId, "equipo", identidad.dispositivoId]);
});
test("RF-101: cuenta sin roles se rechaza aunque exista credencial activa", async () => {
  jest.mocked(consultar).mockResolvedValue(resultado([{ ...fila, roles: [] }]));
  expect(await autenticarPeticion(peticion(await firmarJwt(identidad)))).toBeNull();
});
test("RF-110: enlace familiar sin rol o sin hijos vigentes no habilita acceso", async () => {
  const jwt = await firmarJwt({ cuentaId: identidad.cuentaId, credencialId: identidad.credencialId, tipo: "familia" });
  for (const datos of [{ ...fila, roles: ["familia"], hijos: [] }, { ...fila, roles: ["catequista"], hijos: ["hijo"] }]) {
    jest.mocked(consultar).mockResolvedValue(resultado([datos]));
    expect(await autenticarPeticion(peticion(jwt))).toBeNull();
  }
});
test("RF-111: credencial del equipo no sirve después de quitar todos sus roles de equipo", async () => {
  jest.mocked(consultar).mockResolvedValue(resultado([{ ...fila, roles: ["familia"], hijos: ["hijo"] }]));
  expect(await autenticarPeticion(peticion(await firmarJwt(identidad)))).toBeNull();
});
test("RF-101 RNF-101: fallo de BD cierra acceso, no ejecuta manejador ni devuelve datos o errores internos", async () => {
  jest.mocked(consultar).mockRejectedValue(new Error("secreto-de-conexion"));
  const manejador = jest.fn(async () => ({ jsonBody: { salud: "dato-que-no-debe-salir" } }));
  const respuesta = await conAcceso({ accion: "yo:leer" }, manejador)(peticion(await firmarJwt(identidad)), new InvocationContext({ functionName: "sonda" }));
  expect(respuesta).toMatchObject({ status: 500, jsonBody: { codigo: "error_interno" }, headers: { "Cache-Control": "no-store" } });
  expect(manejador).not.toHaveBeenCalled();
});
