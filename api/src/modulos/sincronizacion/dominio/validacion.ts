import { z } from "zod";
import { esquemaActividad } from "../../actividades/dominio/validacion";
const uuid = z.string().uuid();
const sello = z.number().int().min(0).max(8640000000000000);
const desfase = z.number().int().min(-86400000).max(86400000);
const autoria = { cuenta_id: uuid, credencial_id: uuid, dispositivo_id: uuid };
const comunes = { id: uuid, ciclo_id: uuid, sesion_id: uuid };
const valor = z.enum(["presente", "ausente"]);
const horaCivil = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).refine(hora => [5, 8].includes(hora.length));
export const esquemaSesion = z.object({ id: uuid, ciclo_id: uuid, fecha: z.string().length(10).regex(/^\d{4}-\d{2}-\d{2}$/), tipo: z.enum(["misa", "catequesis", "actividad"]), actividad_id: uuid.nullable().optional(), ventana_inicio: horaCivil.nullable().optional(), ventana_fin: horaCivil.nullable().optional(), cancelada: z.boolean(), motivo_cancelacion: z.string().max(300).nullable().optional(), actualizado_por: uuid, ...autoria }).strict();
export const esquemaLista = z.object({ ...comunes, grupo_id: uuid, confirmada_por: uuid, abierta_en: sello, confirmada_en: sello, desfase_reloj_ms: desfase, total_presentes: z.number().int().min(0).max(10000), total_ausentes: z.number().int().min(0).max(10000), ...autoria }).strict();
export const esquemaMarca = z.object({ ...comunes, catequizando_id: uuid.nullable(), codigo_leido: z.string().max(200).nullable().optional(), valor, tipo_registro: z.enum(["escaneo", "manual", "lista"]), lista_id: uuid.nullable().optional(), registrado_por: uuid, hora_dispositivo: sello, desfase_reloj_ms: desfase, ...autoria }).strict();
export const esquemaCorreccion = z.object({ ...comunes, catequizando_id: uuid, valor_anterior: z.enum(["presente", "ausente", "sin_registro"]), valor_nuevo: valor, motivo: z.string().max(300).nullable().optional(), corregido_por: uuid, hora_dispositivo: sello, desfase_reloj_ms: desfase, ...autoria }).strict();
export type EntradaSesion = z.infer<typeof esquemaSesion>;
export type EntradaLista = z.infer<typeof esquemaLista>;
export type EntradaMarca = z.infer<typeof esquemaMarca>;
export type EntradaCorreccion = z.infer<typeof esquemaCorreccion>;
const cambios = <T extends z.ZodTypeAny>(esquema: T) => z.object({ created: z.array(esquema).max(5000), updated: z.array(esquema).max(5000), deleted: z.array(uuid).max(5000) }).strict();
function ignorarMetadatosLocales(entrada: unknown): unknown {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return entrada;
  const cuerpo = entrada as Record<string, unknown>;
  if (!cuerpo.changes || typeof cuerpo.changes !== "object" || Array.isArray(cuerpo.changes)) return entrada;
  const changes = Object.fromEntries(Object.entries(cuerpo.changes).map(([tabla, cambio]) => {
    if (!cambio || typeof cambio !== "object" || Array.isArray(cambio)) return [tabla, cambio];
    return [tabla, Object.fromEntries(Object.entries(cambio).map(([operacion, filas]) => [operacion,
      ["created", "updated"].includes(operacion) && Array.isArray(filas) ? filas.map(fila => {
        if (!fila || typeof fila !== "object" || Array.isArray(fila)) return fila;
        const feedback = ["listas_asistencia", "marcas_asistencia", "correcciones_asistencia"].includes(tabla);
        return Object.fromEntries(Object.entries(fila).filter(([campo]) => campo !== "_status" && campo !== "_changed" && !(feedback && ["estado", "motivo_rechazo", "recibido_en"].includes(campo))));
      }) : filas,
    ]))];
  }));
  return { ...cuerpo, changes };
}
export const esquemaPush = z.preprocess(ignorarMetadatosLocales, z.object({ changes: z.object({
  actividades_obligatorias: cambios(esquemaActividad).optional(),
  sesiones: cambios(esquemaSesion).optional(), listas_asistencia: cambios(esquemaLista).optional(),
  marcas_asistencia: cambios(esquemaMarca).optional(), correcciones_asistencia: cambios(esquemaCorreccion).optional(),
}).strict() }).strict());
export type EntradaPush = z.infer<typeof esquemaPush>;
