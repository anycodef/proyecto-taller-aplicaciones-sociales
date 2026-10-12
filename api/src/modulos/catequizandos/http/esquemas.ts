import { z } from "zod";
import { esFechaCivil } from "@/lib/catequizandos/edad";
import { CATEGORIAS_CONDICION } from "@/lib/catequizandos/condiciones";
import { TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";
import { RELACIONES } from "@/lib/catequizandos/apoderados";
export const uuid = z.string().uuid();
export const fechaCivil = z.string().refine(esFechaCivil);
export const texto = z.string().trim().min(1).max(200);
export const nino = z.object({ id: uuid, nombres: texto, apellidos: texto, fechaNacimiento: fechaCivil, sexo: z.enum(["femenino", "masculino"]), bautizado: z.boolean() }).strict();
const apoderado = z.object({ id: uuid, nombres: texto, apellidos: texto, tipoContacto: z.enum(["telefono", "otro"]), valorContacto: texto, cuentaId: uuid, credencialId: uuid }).strict();
const baseVinculo = { id: uuid, relacion: z.enum(RELACIONES), detalleRelacion: z.string().trim().max(100).optional() };
export const vinculo = z.union([z.object({ ...baseVinculo, apoderadoId: uuid }).strict(), z.object({ ...baseVinculo, apoderado }).strict()]);
export const inscripcion = z.object({ id: uuid, nino, apoderados: z.array(vinculo).min(1).max(10), grupoId: uuid, asignacionId: uuid,
  consentimiento: z.object({ id: uuid, apoderadoId: uuid, textoId: uuid, canal: z.literal("presencial") }).strict().optional(),
  documentos: z.array(z.object({ id: uuid, tipo: z.enum(TIPOS_DOCUMENTO) }).strict()).length(5).refine(d => new Set(d.map(v => v.tipo)).size === 5 && new Set(d.map(v => v.id)).size === 5),
  edadFueraRangoConfirmada: z.boolean(), referenciaDuplicado: uuid.optional()
}).strict().refine(d => new Set(d.apoderados.map(v => "apoderadoId" in v ? v.apoderadoId : v.apoderado.id)).size === d.apoderados.length);
export const confirmarDuplicado = z.object({ referencia: uuid, esElMismo: z.boolean() }).strict();
export const grupo = z.object({ id: uuid, cicloId: uuid, nombre: texto, edadMinima: z.number().int().min(0).max(120), edadMaxima: z.number().int().min(0).max(120), modalidad: z.enum(["mixto", "femenino", "masculino"]) }).strict().refine(g => g.edadMinima <= g.edadMaxima);
export const editarGrupo = z.object({ nombre: texto.optional(), edadMinima: z.number().int().min(0).max(120).optional(), edadMaxima: z.number().int().min(0).max(120).optional(), modalidad: z.enum(["mixto", "femenino", "masculino"]).optional() }).strict().refine(g => Object.keys(g).length > 0);
export const asignar = z.object({ id: uuid, grupoId: uuid, cambioId: uuid, motivo: texto.optional() }).strict();
export const catequistas = z.object({ asignaciones: z.array(z.object({ id: uuid, cuentaId: uuid }).strict()).max(20) }).strict().refine(d => new Set(d.asignaciones.map(a => a.cuentaId)).size === d.asignaciones.length && new Set(d.asignaciones.map(a => a.id)).size === d.asignaciones.length);
export const sugerencia = z.object({ fechaNacimiento: fechaCivil, sexo: z.enum(["femenino", "masculino"]) }).strict();
export const anular = z.object({ cambioId: uuid, motivo: texto }).strict();
export const corregir = z.object({ datos: nino.omit({ id: true }).partial().strict().refine(d => Object.keys(d).length > 0), cambios: z.array(z.object({ id: uuid, campo: z.enum(["nombres", "apellidos", "fechaNacimiento", "sexo", "bautizado"]) }).strict()).min(1).max(5), motivo: texto.optional() }).strict().refine(d => new Set(d.cambios.map(c => c.campo)).size === d.cambios.length && new Set(d.cambios.map(c => c.id)).size === d.cambios.length);
export const documento = z.object({ cambioId: uuid, estado: z.enum(["pendiente", "entregado", "invalido", "no_aplica"]), fechaEstado: fechaCivil, motivo: texto.optional() }).strict();
export const condiciones = z.object({ condiciones: z.array(z.object({ id: uuid, categoria: z.enum(CATEGORIAS_CONDICION), nota: z.string().refine(n => [...n].length <= 200).optional() }).strict()).max(7) }).strict().refine(d => new Set(d.condiciones.map(c => c.categoria)).size === d.condiciones.length && new Set(d.condiciones.map(c => c.id)).size === d.condiciones.length);
export const vincular = z.object({ vinculo, cambioId: uuid }).strict();
export const desvincular = z.object({ cambioId: uuid, motivo: texto.optional() }).strict();
export const reemitir = z.object({ emisionEsperada: z.number().int().min(0).max(2147483646) }).strict();
