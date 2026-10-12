import type { Tx } from "../../../src/compartido/bd/transaccion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { PeticionInscripcion } from "@/lib/catequizandos/contratos";
import { crearInscripcion, confirmarDuplicado } from "../../../src/modulos/inscripciones/aplicacion/inscribir";
import { consultarCondiciones } from "../../../src/modulos/catequizandos/aplicacion/condiciones";
import { reemitirCarne } from "../../../src/modulos/catequizandos/aplicacion/carnes";
import { anonimizarCatequizando } from "../../../src/modulos/catequizandos/aplicacion/retencion";
import { proveedorNomina } from "../../../src/modulos/catequizandos/aplicacion/proveedor-nomina";
import { resolverCarne } from "../../../src/modulos/catequizandos/aplicacion/consultas";
import { inscripcion, condiciones, grupo } from "../../../src/modulos/catequizandos/http/esquemas";
import { TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";
import { consultar } from "../../../src/compartido/bd/pool";
jest.mock("../../../src/compartido/bd/pool", () => ({ consultar: jest.fn() }));
const id = "00200000-0000-4000-8000-000000000001", id2 = "00200000-0000-4000-8000-000000000002";
const contexto: ContextoAcceso = { cuentaId: id, credencialId: id2, rolesPropios: ["coordinacion"], gruposAsignados: [], catequizandosApoderados: [], identidadOperativa: "Luz 2", esMenor: false };
const datos: PeticionInscripcion = { id, nino: { id: id2, nombres: "Ana", apellidos: "Perez", fechaNacimiento: "2016-01-01", sexo: "femenino", bautizado: false }, grupoId: id, asignacionId: id, edadFueraRangoConfirmada: false, apoderados: [{ id, apoderadoId: id, relacion: "madre" }], consentimiento: { id, apoderadoId: id, textoId: id, canal: "presencial" }, documentos: TIPOS_DOCUMENTO.map((tipo, indice) => ({ id: `00200000-0000-4000-8000-00000000001${indice}`, tipo })) };
const resultado = (rows: unknown[] = []) => ({ rows, rowCount: rows.length });
function transaccion(manejar: (sql: string, parametros?: unknown[]) => unknown = () => resultado()) {
  const query = jest.fn(async (sql: string, parametros?: unknown[]) => manejar(sql, parametros));
  return { tx: { query } as unknown as Tx, query };
}
beforeEach(() => jest.clearAllMocks());
test("RF-202: sin consentimiento no se escribe ni se consulta", async () => {
  const { tx, query } = transaccion();
  await expect(crearInscripcion(tx, { ...datos, consentimiento: undefined }, contexto)).rejects.toMatchObject({ estado: 422, codigo: "sin_consentimiento" });
  expect(query).not.toHaveBeenCalled();
});
test("RF-202: mismo UUID con payload diferente responde 409 sin sobrescribir", async () => {
  const { tx, query } = transaccion(sql => sql.includes("SELECT huella_peticion") ? resultado([{ huella_peticion: "otra", catequizando_id: id2 }]) : resultado());
  await expect(crearInscripcion(tx, datos, contexto)).rejects.toMatchObject({ estado: 409, codigo: "uuid_en_conflicto" });
  expect(query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE/.test(sql))).toBe(false);
});
test("RF-201: posible duplicado persiste referencia temporal sin revelar perfil", async () => {
  const { tx, query } = transaccion(sql => {
    if (sql.includes("SELECT id,inicio")) return resultado([{ id, inicio: "2026-01-01" }]);
    if (sql.includes("SELECT id,edad_minima")) return resultado([{ id, edad_minima: 8, edad_maxima: 10, modalidad: "mixto" }]);
    if (sql.includes("WHERE clave_duplicado=$1")) return resultado([{ id: "perfil-secreto" }]);
    return resultado();
  });
  const r = await crearInscripcion(tx, datos, contexto);
  expect(r.estado).toBe(409);
  expect(Object.keys(r.datos).sort()).toEqual(["codigo", "referencia"]);
  expect(JSON.stringify(r.datos)).not.toMatch(/Ana|Perez|2016|perfil-secreto/);
  expect(query.mock.calls.some(([sql]) => sql.includes("interval '15 minutes'"))).toBe(true);
  expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO referencia_duplicado"))).toBe(true);
});
test("RF-201: referencia vencida o ajena no devuelve perfil", async () => {
  const { tx, query } = transaccion();
  await expect(confirmarDuplicado(tx, id, true, contexto)).rejects.toMatchObject({ estado: 403 });
  expect(query.mock.calls.some(([sql]) => sql.includes("FROM catequizando"))).toBe(false);
});
test("RF-201: confirmar otro niño no consulta ni expone datos existentes", async () => {
  const { tx, query } = transaccion(sql => sql.startsWith("SELECT catequizando_id") ? resultado([{ catequizando_id: id2, es_el_mismo: null }]) : resultado());
  expect(await confirmarDuplicado(tx, id, false, contexto)).toEqual({ referencia: id, duplicadoDescartado: true });
  expect(query.mock.calls.some(([sql]) => sql.includes("FROM catequizando"))).toBe(false);
});
test("RF-205: falla de auditoría impide leer condiciones", async () => {
  const { tx, query } = transaccion(sql => { if (sql.includes("evento_auditoria")) throw new Error("auditoria_no_disponible"); return resultado([{ categoria: "otra", nota: "No debe salir" }]); });
  await expect(consultarCondiciones(tx, id, contexto)).rejects.toThrow("auditoria_no_disponible");
  expect(query.mock.calls.some(([sql]) => sql.includes("FROM condicion_catequizando"))).toBe(false);
});
test("RF-302: reemisión bloquea perfil antes de invalidar y emite correlativo", async () => {
  const { tx, query } = transaccion(sql => {
    if (sql.includes("FROM catequizando")) return resultado([{ id }]);
    if (sql.includes("SELECT id,inicio")) return resultado([{ id, inicio: "2026-01-01" }]);
    if (sql.includes("FROM v_nomina_ciclo")) return resultado([{ catequizandoId: id, nombres: "Ana", apellidos: "Perez", grupoId: id2, grupo: "A", emision: 3 }]);
    return resultado();
  });
  expect((await reemitirCarne(tx, id, 3, contexto)).codigoCarne).toBe(`SGC1:${id}:4`);
  const sentencias = query.mock.calls.map(([sql]) => sql);
  expect(sentencias[0]).toContain("FOR UPDATE");
  expect(sentencias.findIndex(sql => sql.startsWith("UPDATE carne_emision"))).toBeLessThan(sentencias.findIndex(sql => sql.startsWith("INSERT INTO carne_emision")));
});
test("RF-106 RF-201: anonimización exige rol y contexto de retención conjuntamente", async () => {
  const { tx, query } = transaccion(() => resultado([{ autorizado: false }]));
  await expect(anonimizarCatequizando(id, tx)).rejects.toMatchObject({ estado: 403 });
  expect(query.mock.calls).toHaveLength(1);
});
test("RF-201: un código mal formado no consulta PostgreSQL", async () => {
  expect(await resolverCarne(id)).toBeNull();
  expect(consultar).not.toHaveBeenCalled();
});
test("RNF-203 RNF-204: pull mínimo deriva codigo_carne sin datos restringidos", async () => {
  const consulta = jest.mocked(consultar);
  consulta.mockResolvedValueOnce(resultado([{ id, nombres: "Ana", apellidos: "Perez", grupo_id: id2, emision: 1 }]) as never);
  consulta.mockResolvedValueOnce(resultado() as never);
  consulta.mockResolvedValueOnce(resultado([{ id: id2, nombre: "A", ciclo_id: id, estado: "abierto", es_mio: true }]) as never);
  consulta.mockResolvedValueOnce(resultado() as never);
  const cambios = await proveedorNomina.cambiosDesde(null, { cuentaId: id });
  expect(Object.keys(cambios.catequizandos.creados[0]).sort()).toEqual(["activo", "apellidos", "codigo_carne", "grupo_id", "id", "nombres"]);
  expect(cambios.catequizandos.creados[0].codigo_carne).toBe(`SGC1:${id}:1`);
  expect(JSON.stringify(cambios)).not.toMatch(/fecha_nacimiento|nota|condicion|documento|contacto/);
});
test("RF-202 RF-205 RF-206: HTTP estricto exige UUID anidados y rangos válidos", () => {
  expect(inscripcion.safeParse(datos).success).toBe(true);
  expect(inscripcion.safeParse({ ...datos, dni: "12345678" }).success).toBe(false);
  expect(inscripcion.safeParse({ ...datos, grupoId: "grupo" }).success).toBe(false);
  expect(inscripcion.safeParse({ ...datos, apoderados: [{ id, apoderadoId: "apoderado", relacion: "madre" }] }).success).toBe(false);
  expect(condiciones.safeParse({ condiciones: [{ id, categoria: "otra", diagnostico: "No permitido" }] }).success).toBe(false);
  expect(grupo.safeParse({ id, cicloId: id2, nombre: "A", edadMinima: 13, edadMaxima: 8, modalidad: "mixto" }).success).toBe(false);
});
