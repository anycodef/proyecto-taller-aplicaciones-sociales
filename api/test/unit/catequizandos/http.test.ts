import { HttpRequest, type InvocationContext } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { autenticarPeticion, auditar } from "../../../src/modulos/seguridad";
import { consultar } from "../../../src/compartido/bd/pool";
import { manejadoresCatequizandos } from "../../../src/modulos/catequizandos/http";
import { manejadoresInscripciones } from "../../../src/modulos/inscripciones/http";
jest.mock("../../../src/modulos/seguridad", () => ({ autenticarPeticion: jest.fn(), auditar: jest.fn() }));
jest.mock("../../../src/compartido/bd/pool", () => ({ consultar: jest.fn() }));
jest.mock("../../../src/compartido/bd/transaccion", () => ({ enTransaccion: (operacion: (tx: unknown) => Promise<unknown>) => operacion({ query: jest.requireMock("../../../src/compartido/bd/pool").consultar }) }));
const id = "00200000-0000-4000-8000-000000000001", grupoId = "00200000-0000-4000-8000-000000000002";
const invocacion = {} as InvocationContext;
const contexto = (...rolesPropios: Rol[]): ContextoAcceso => ({ cuentaId: id, credencialId: id, rolesPropios, gruposAsignados: [grupoId], catequizandosApoderados: [id], identidadOperativa: "Luz 2", esMenor: true });
function peticion(cuerpo: unknown = {}, metodo = "POST", tipo = "documento_identidad") {
  return new HttpRequest({ method: metodo, url: "https://sigecat.example/v1/prueba", params: { id, cicloId: id, apoderadoId: id, tipo }, ...(metodo === "GET" || metodo === "HEAD" ? {} : { body: { string: JSON.stringify(cuerpo) } }) });
}
const resultado = (rows: unknown[] = []) => ({ rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auditar).mockResolvedValue();
  jest.mocked(autenticarPeticion).mockResolvedValue(contexto("coordinacion"));
  jest.mocked(consultar).mockImplementation(async sql => {
    if (sql.includes("SELECT a.grupo_id")) return resultado([{ grupo_id: grupoId }]) as never;
    if (sql.includes("SELECT catequizando_id FROM inscripcion")) return resultado([{ catequizando_id: id }]) as never;
    if (sql.includes("SELECT id,categoria,nota")) return resultado([{ id, categoria: "otra", nota: "Instrucciones cortas" }]) as never;
    if (sql.includes("SELECT id,nombres,apellidos,fecha_nacimiento")) return resultado([{ id, nombres: "Ana", apellidos: "Perez", fechaNacimiento: "2016-01-01", sexo: "femenino", bautizado: false }]) as never;
    if (sql.includes('SELECT i.id,i.ciclo_id AS "cicloId"')) return resultado([{ id, cicloId: id, grupoId, grupo: "A" }]) as never;
    if (sql.includes("AT TIME ZONE 'America/Lima')::date::text AS fecha")) return resultado([{ fecha: "2026-10-11" }]) as never;
    if (sql.includes("SELECT d.id,d.tipo,d.estado")) return resultado([{ id, tipo: "documento_identidad", estado: "pendiente", fechaEstado: "2026-10-11", recibidoPor: null }]) as never;
    return resultado() as never;
  });
});
test("RF-201 RF-202 RF-204 RF-205 RF-206 RF-207 RF-302: todas las rutas devuelven 401 antes de consultar recursos sin sesión", async () => {
  jest.mocked(autenticarPeticion).mockResolvedValue(null);
  for (const manejador of [...Object.values(manejadoresCatequizandos), ...Object.values(manejadoresInscripciones)]) {
    const r = await manejador(peticion(), invocacion);
    expect(r.status).toBe(401);
    expect(r.jsonBody).toEqual({ codigo: "acceso_denegado" });
  }
  expect(consultar).not.toHaveBeenCalled();
});
test("RF-202 RF-203 RF-204 RF-205 RF-206 RF-207 RF-302: CAT, FAM, SUP y delegado vencido reciben 403 en toda escritura administrativa", async () => {
  const escrituras = [manejadoresInscripciones.inscribir, manejadoresInscripciones.confirmarDuplicado, manejadoresInscripciones.anular, manejadoresInscripciones.cambiarDocumento,
    manejadoresCatequizandos.corregir, manejadoresCatequizandos.guardarCondiciones, manejadoresCatequizandos.vincular, manejadoresCatequizandos.desvincular,
    manejadoresCatequizandos.crearGrupo, manejadoresCatequizandos.editarGrupo, manejadoresCatequizandos.cerrarGrupo, manejadoresCatequizandos.catequistas, manejadoresCatequizandos.sugerencias, manejadoresCatequizandos.asignarGrupo, manejadoresCatequizandos.reemitir];
  for (const rol of ["catequista", "familia", "supervision"] as Rol[]) {
    jest.mocked(autenticarPeticion).mockResolvedValue(contexto(rol));
    for (const manejador of escrituras) {
      const r = await manejador(peticion({ nota: "No debe validarse ni guardarse" }), invocacion);
      expect(r.status).toBe(403); expect(r.jsonBody).toEqual({ codigo: "fuera_de_alcance" });
    }
  }
  expect(jest.mocked(auditar)).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ resultado: "denegado" }));
  expect(jest.mocked(consultar).mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE/.test(sql))).toBe(false);
});
test("RF-201 RF-204 RF-205: hijo o grupo ajeno y SUP no obtienen perfil ni restringidos", async () => {
  const lectores = [manejadoresCatequizandos.perfil, manejadoresCatequizandos.condiciones, manejadoresInscripciones.documentos];
  for (const rol of ["catequista", "familia", "supervision"] as Rol[]) {
    jest.mocked(autenticarPeticion).mockResolvedValue({ ...contexto(rol), gruposAsignados: [], catequizandosApoderados: [] });
    for (const manejar of lectores) {
      const r = await manejar(peticion({}, "GET"), invocacion);
      expect(r.status).toBe(403); expect(r.jsonBody).toEqual({ codigo: "fuera_de_alcance" });
    }
  }
  expect(jest.mocked(consultar).mock.calls.some(([sql]) => sql.includes("condicion_catequizando"))).toBe(false);
});
test("RF-201 RF-204 RNF-203: FAM vinculada lee perfil/documentos con no-store y sin historial ni apoderados", async () => {
  jest.mocked(autenticarPeticion).mockResolvedValue(contexto("familia"));
  const perfil = await manejadoresCatequizandos.perfil(peticion({}, "GET"), invocacion);
  expect(perfil.status).toBe(200);
  expect(perfil.headers).toEqual({ "Cache-Control": "no-store" });
  expect(perfil.jsonBody).toMatchObject({ catequizandoId: id, nombres: "Ana", edad: 10, grupo: { id: grupoId }, documentos: [{ estado: "pendiente" }] });
  expect(perfil.jsonBody).not.toHaveProperty("apoderados");
  expect(perfil.jsonBody).not.toHaveProperty("historialGrupos");
  expect(perfil.jsonBody).not.toHaveProperty("fechaNacimiento");
  const documentos = await manejadoresInscripciones.documentos(peticion({}, "GET"), invocacion);
  expect(documentos.status).toBe(200);
  expect(documentos.headers).toEqual({ "Cache-Control": "no-store" });
  expect(JSON.stringify(documentos.jsonBody)).not.toMatch(/archivo|url|imagen/);
});
test("RF-205 RNF-203: CAT propio y delegado vigente leen condiciones auditadas con no-store", async () => {
  for (const ctx of [contexto("catequista"), { ...contexto("catequista"), gruposAsignados: [], delegacionVigente: { id, hasta: "2027-01-01T00:00:00Z" } }]) {
    jest.mocked(autenticarPeticion).mockResolvedValue(ctx);
    const r = await manejadoresCatequizandos.condiciones(peticion({}, "GET"), invocacion);
    expect(r.status).toBe(200);
    expect(r.headers).toEqual({ "Cache-Control": "no-store" });
    expect(r.jsonBody).toMatchObject({ condiciones: [{ categoria: "otra" }] });
  }
  expect(jest.mocked(consultar).mock.calls.filter(([sql]) => sql.includes("INSERT INTO evento_auditoria"))).toHaveLength(2);
});
test("RF-205: auditoría caída devuelve 500 genérico sin leer condiciones ni registrarlas en logs", async () => {
  const registrar = jest.spyOn(console, "log").mockImplementation(() => undefined);
  const fallar = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const consulta = jest.mocked(consultar).getMockImplementation()!;
    jest.mocked(consultar).mockImplementation(async (sql, parametros) => {
      if (sql.includes("INSERT INTO evento_auditoria")) throw new Error("auditoria_caida");
      return consulta(sql, parametros) as never;
    });
    const r = await manejadoresCatequizandos.condiciones(peticion({}, "GET"), invocacion);
    expect(r.status).toBe(500); expect(r.jsonBody).toEqual({ codigo: "error_interno" });
    expect(jest.mocked(consultar).mock.calls.some(([sql]) => sql.includes("SELECT id,categoria,nota"))).toBe(false);
    expect(registrar).not.toHaveBeenCalled(); expect(fallar).not.toHaveBeenCalled();
  } finally { registrar.mockRestore(); fallar.mockRestore(); }
});
test("RF-202 RF-204 RF-205 RF-206: UUID, campos desconocidos y notas inválidas responden 422 sin mutar", async () => {
  const casos = [
    [manejadoresInscripciones.inscribir, { dni: "No permitido" }],
    [manejadoresCatequizandos.guardarCondiciones, { condiciones: [{ id, categoria: "otra", nota: "a".repeat(201) }] }],
    [manejadoresCatequizandos.crearGrupo, { id, cicloId: "ciclo-no-uuid", nombre: "A", edadMinima: 8, edadMaxima: 10, modalidad: "mixto" }],
    [manejadoresInscripciones.cambiarDocumento, { cambioId: id, estado: "invalido", fechaEstado: "2026-02-30" }]
  ] as const;
  for (const [manejar, cuerpo] of casos) {
    const r = await manejar(peticion(cuerpo), invocacion);
    expect(r.status).toBe(422); expect(r.jsonBody).toEqual({ codigo: "entrada_invalida" });
  }
  expect(jest.mocked(consultar).mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE/.test(sql))).toBe(false);
});
