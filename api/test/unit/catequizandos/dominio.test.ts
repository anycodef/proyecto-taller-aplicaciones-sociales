import { edadEnFecha, esFechaCivil, estaEnRangoCatequesis } from "@/lib/catequizandos/edad";
import { claveDuplicado, normalizarTexto } from "@/lib/catequizandos/duplicados";
import { codificarCarne, interpretarCodigoCarne } from "@/lib/catequizandos/carne";
import { validarInscripcion, CAMPOS_OBLIGATORIOS } from "@/lib/catequizandos/inscripcion";
import { estadosIniciales, aplicarCambioDocumento, cuentaComoPendiente } from "@/lib/catequizandos/documentos";
import { validarCondiciones } from "@/lib/catequizandos/condiciones";
import { sugerirGrupos, puedeCerrarGrupo, gruposSinCatequista } from "@/lib/catequizandos/grupos";
import { validarVinculo, efectoDesvinculacion } from "@/lib/catequizandos/apoderados";
import { diferenciasCorregibles, cambiaGrupoSugerido } from "@/lib/catequizandos/correcciones";
import { camposDePerfilVisibles, puedeGestionarInscripciones, puedeVerCondiciones } from "@/lib/catequizandos/autorizacion";
import { crearApiCatequizandos } from "@/lib/catequizandos/api";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import type { Grupo } from "@/lib/catequizandos/modelo";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const id = "00200000-0000-4000-8000-000000000001";
const ctx = (...roles: Rol[]): ContextoAcceso => ({ cuentaId: id, credencialId: id, rolesPropios: roles, gruposAsignados: ["grupo"], catequizandosApoderados: [id], identidadOperativa: "Luz 2", esMenor: true });
const grupos: Grupo[] = [{ id: "grupo", cicloId: "ciclo", nombre: "A", edadMinima: 8, edadMaxima: 10, modalidad: "mixto", estado: "abierto" }, { id: "otro", cicloId: "ciclo", nombre: "B", edadMinima: 8, edadMaxima: 10, modalidad: "mixto", estado: "abierto" }, { id: "mayores", cicloId: "ciclo", nombre: "C", edadMinima: 11, edadMaxima: 13, modalidad: "femenino", estado: "abierto" }];
const nino = { id, nombres: "Ana", apellidos: "Perez", fechaNacimiento: "2016-04-01", sexo: "femenino" as const, bautizado: false };
test("RF-201: dominio no importa React, React Native ni Expo", () => {
  const carpeta = resolve(__dirname, "../../../../src/lib/catequizandos");
  for (const archivo of readdirSync(carpeta).filter(a => a.endsWith(".ts"))) expect(readFileSync(resolve(carpeta, archivo), "utf8")).not.toMatch(/(?:from\s*|import\s*\()\s*["'](?:react|react-native|expo)(?:["'/\-])/);
});
test("RF-201: duplicado normaliza tildes, espacios y mayúsculas sin DNI", () => {
  expect(normalizarTexto(" JOSÉ  Pérez ")).toBe("jose perez");
  expect(claveDuplicado("José", "Pérez", "2016-04-01")).toBe(claveDuplicado("jose", "perez", "2016-04-01"));
  expect(claveDuplicado("José", "Pérez", "2016-04-02")).not.toBe(claveDuplicado("José", "Pérez", "2016-04-01"));
});
test("RF-202: cumpleaños al inicio del ciclo y fechas civiles imposibles", () => {
  expect(edadEnFecha("2012-05-01", "2026-04-01")).toBe(13);
  expect(edadEnFecha("2012-05-01", "2026-05-01")).toBe(14);
  expect([7, 8, 13, 14].map(estaEnRangoCatequesis)).toEqual([false, true, true, false]);
  expect(esFechaCivil("2026-02-29")).toBe(false);
  expect(esFechaCivil("2024-02-29")).toBe(true);
  expect(() => edadEnFecha("2030-01-01", "2026-01-01")).toThrow();
});
test("RF-202 RNF-201: obligatorios, apoderado, consentimiento y confirmación de edad", () => {
  expect(CAMPOS_OBLIGATORIOS).toEqual(["nombres", "apellidos", "fechaNacimiento", "sexo", "bautizado", "apoderados", "consentimiento"]);
  const validar = (datos: Parameters<typeof validarInscripcion>[0]) => validarInscripcion(datos, { inicioCiclo: "2026-04-01" });
  expect(validar({}).bloqueos).toEqual(expect.arrayContaining(["datos_obligatorios", "sin_apoderado_con_contacto", "sin_consentimiento"]));
  const datos = { ...nino, fechaNacimiento: "2019-04-01", apoderados: [{ valorContacto: "999999999" }], consentimiento: { id } };
  expect(validar(datos).advertencias).toContain("edad_fuera_de_rango_sin_confirmar");
  expect(validar({ ...datos, edadFueraRangoConfirmada: true }).advertencias).toEqual([]);
});
test("RF-202 RF-205: escritura exclusiva coordinación y lectura condiciones por alcance", () => {
  for (const rol of ["familia", "supervision", "catequista", "administracion"] as Rol[]) expect(puedeGestionarInscripciones(ctx(rol))).toBe(false);
  expect(puedeGestionarInscripciones(ctx("coordinacion"))).toBe(true);
  expect(puedeGestionarInscripciones({ ...ctx("catequista"), delegacionVigente: { id, hasta: "2027-01-01" } })).toBe(true);
  expect(puedeVerCondiciones(ctx("catequista"), "grupo")).toBe(true);
  expect(puedeVerCondiciones(ctx("catequista"), "ajeno")).toBe(false);
  expect(puedeVerCondiciones(ctx("familia"), "grupo")).toBe(false);
});
test("RF-201: familia vinculada sin historial y SUP sin perfil", () => {
  const visibles = camposDePerfilVisibles(ctx("familia"), { id, grupoId: "grupo" });
  expect(visibles).toContain("documentos");
  expect(visibles).not.toContain("historialGrupos");
  expect(visibles).not.toContain("apoderados");
  expect(camposDePerfilVisibles(ctx("supervision"), { id, grupoId: "grupo" })).toEqual([]);
  expect(camposDePerfilVisibles(ctx("familia"), { id: "ajeno" })).toEqual([]);
});
test("RF-203: diferencias guardan anterior y nuevo y no alteran grupo", () => {
  expect(diferenciasCorregibles(nino, { nombres: "Ana Maria", bautizado: true })).toEqual([{ campo: "nombres", valorAnterior: "Ana", valorNuevo: "Ana Maria" }, { campo: "bautizado", valorAnterior: false, valorNuevo: true }]);
  expect(cambiaGrupoSugerido(grupos, nino, { ...nino, fechaNacimiento: "2014-04-01" }, "grupo", "2026-04-01")).toBe(true);
  expect(cambiaGrupoSugerido(grupos, nino, { ...nino, nombres: "Ana Maria" }, "grupo", "2026-04-01")).toBe(false);
});
test("RF-204: cinco documentos, bautismo, invalidez y exoneración", () => {
  expect(estadosIniciales(false)).toHaveLength(5);
  expect(estadosIniciales(false).find(d => d.tipo === "partida_bautismo")?.estado).toBe("no_aplica");
  expect(aplicarCambioDocumento("no_aplica", { estado: "pendiente" }).valido).toBe(true);
  expect(aplicarCambioDocumento("entregado", { estado: "invalido" }).valido).toBe(false);
  expect(aplicarCambioDocumento("entregado", { estado: "invalido", motivo: "Ilegible" }).valido).toBe(true);
  expect(cuentaComoPendiente("invalido")).toBe(true);
  expect(aplicarCambioDocumento("pendiente", { estado: "no_aplica", motivo: "exonerado" }).valido).toBe(true);
  expect(cuentaComoPendiente("no_aplica")).toBe(false);
  expect(aplicarCambioDocumento("no_aplica", { estado: "entregado" }).valido).toBe(false);
});
test("RF-205: lista cerrada, duplicados y nota hasta 200 caracteres", () => {
  expect(validarCondiciones([{ categoria: "diagnostico" }])).toBe(false);
  expect(validarCondiciones([{ categoria: "alergia", nota: "a".repeat(201) }])).toBe(false);
  expect(validarCondiciones([{ categoria: "otra", nota: "a".repeat(200) }])).toBe(true);
  expect(validarCondiciones([{ categoria: "otra" }, { categoria: "otra" }])).toBe(false);
});
test("RF-206: dos grupos de 8, mayores por sexo, cerrados excluidos y cierre ocupado", () => {
  expect(sugerirGrupos(8, "femenino", grupos).map(g => g.id)).toEqual(["grupo", "otro"]);
  expect(sugerirGrupos(12, "femenino", grupos).map(g => g.id)).toEqual(["mayores"]);
  expect(sugerirGrupos(12, "masculino", grupos)).toEqual([]);
  expect(sugerirGrupos(8, "femenino", grupos.map(g => ({ ...g, estado: "cerrado" })))).toEqual([]);
  expect(gruposSinCatequista(grupos, [{ grupoId: "grupo" }]).map(g => g.id)).toEqual(["otro", "mayores"]);
  expect(puedeCerrarGrupo(1)).toBe(false);
  expect(puedeCerrarGrupo(0)).toBe(true);
});
test("RF-207: abuela, tutor y conservar enlace si hay otro hijo", () => {
  expect(validarVinculo({ relacion: "otro_familiar", detalleRelacion: "abuela" })).toBe(true);
  expect(validarVinculo({ relacion: "tutor" })).toBe(true);
  expect(validarVinculo({ relacion: "vecino" })).toBe(false);
  expect(efectoDesvinculacion(1)).toBe("quitar_alcance_nino");
  expect(efectoDesvinculacion(0)).toBe("revocar_enlace");
});
test("RF-302: QR estricto con emisión sin datos personales", () => {
  expect(codificarCarne(id, 2)).toBe(`SGC1:${id}:2`);
  expect(interpretarCodigoCarne(codificarCarne(id, 2))).toEqual({ catequizandoId: id, emision: 2 });
  for (const codigo of [id, `SGC2:${id}:1`, `SGC1:${id}:0`, `SGC1:${id}:01`, `SGC1:${id}:2147483648`, `SGC1:${id}:1\n`]) expect(interpretarCodigoCarne(codigo)).toEqual({ invalido: true });
});
test("RF-202: cliente conserva UUID y reintento idéntico sin almacén local", async () => {
  const solicitar = jest.fn().mockResolvedValue({});
  const api = crearApiCatequizandos({ solicitar });
  const datos = { id, nino, apoderados: [], grupoId: id, asignacionId: id, documentos: [], edadFueraRangoConfirmada: false };
  await api.inscribir(datos); await api.inscribir(datos);
  expect(solicitar.mock.calls[0]).toEqual(solicitar.mock.calls[1]);
  expect(solicitar.mock.calls[0][2].id).toBe(id);
});
