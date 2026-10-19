import type { Rol } from "./contexto-acceso";
export type Alcance = "ciclo" | "grupos" | "apoderados" | "ninguno";
type Permiso = { escritura: boolean; roles: Partial<Record<Rol, Alcance>>; propia?: boolean };
const coordinacion = { coordinacion: "ciclo" } as const;
const lectura = { coordinacion: "ciclo", catequista: "grupos", familia: "apoderados" } as const;
const consultaOperativa = { ...lectura, supervision: "ciclo" } as const;
export const MATRIZ_PERMISOS = {
  "yo:leer": { escritura: false, roles: { administracion: "ciclo", ...consultaOperativa } },
  "cuentas:gestionar": { escritura: true, roles: { administracion: "ciclo", ...coordinacion } },
  "identidad-real:leer": { escritura: false, roles: { administracion: "ciclo" } },
  "roles:asignar-equipo": { escritura: true, roles: { administracion: "ciclo" } },
  "delegacion:gestionar": { escritura: true, roles: { administracion: "ciclo", ...coordinacion }, propia: true },
  "consentimiento:registrar": { escritura: true, roles: { ...coordinacion, familia: "apoderados" } },
  "consentimiento:retirar": { escritura: true, roles: { ...coordinacion, familia: "apoderados" } },
  "auditoria:leer": { escritura: false, roles: { administracion: "ciclo" } },
  "aviso:publicar": { escritura: true, roles: coordinacion },
  "aviso:leer": { escritura: false, roles: { ...coordinacion, catequista: "grupos" } },
  "avisos-coordinacion:leer": { escritura: false, roles: coordinacion },
  "inscripcion:gestionar": { escritura: true, roles: coordinacion },
  "perfil:leer": { escritura: false, roles: lectura },
  "restringido:leer": { escritura: false, roles: { ...coordinacion, catequista: "grupos" } },
  "restringido:escribir": { escritura: true, roles: coordinacion },
  "documento:leer": { escritura: false, roles: lectura },
  "documento:escribir": { escritura: true, roles: coordinacion },
  "grupo:gestionar": { escritura: true, roles: coordinacion },
  "grupo:leer": { escritura: false, roles: { ...coordinacion, catequista: "grupos" } },
  "apoderado:gestionar": { escritura: true, roles: coordinacion },
  "carne:gestionar": { escritura: true, roles: coordinacion },
  "sincronizacion:operar": { escritura: true, roles: { ...coordinacion, catequista: "ciclo" } },
  "nomina:leer": { escritura: false, roles: { ...coordinacion, catequista: "ciclo" } },
  "asistencia:escanear": { escritura: true, roles: { catequista: "ciclo" } },
  "asistencia:pasar-lista": { escritura: true, roles: { catequista: "ciclo" } },
  "asistencia:manual": { escritura: true, roles: { catequista: "grupos" } },
  "asistencia:corregir": { escritura: true, roles: { ...coordinacion, catequista: "grupos" } },
  "asistencia:leer": { escritura: false, roles: consultaOperativa },
  "reporte:leer": { escritura: false, roles: { ...coordinacion, supervision: "ciclo" } },
  "asistencia:avisos": { escritura: true, roles: coordinacion },
  "actividad:gestionar": { escritura: true, roles: coordinacion },
  "ciclo:gestionar": { escritura: true, roles: { administracion: "ciclo" } },
  "justificacion:leer": { escritura: false, roles: consultaOperativa },
  "evidencia:leer": { escritura: false, roles: { ...coordinacion, catequista: "grupos", supervision: "ciclo" } },
  "avance:leer": { escritura: false, roles: consultaOperativa },
  "aptitud:leer": { escritura: false, roles: consultaOperativa },
  "exportacion:generar": { escritura: false, roles: { ...coordinacion, supervision: "ciclo" } },
} as const satisfies Record<string, Permiso>;
export type Accion = keyof typeof MATRIZ_PERMISOS;
export function permisoPara(accion: string): Permiso | undefined {
  return Object.hasOwn(MATRIZ_PERMISOS, accion) ? MATRIZ_PERMISOS[accion as Accion] : undefined;
}

/**
 * Roles que quien administra puede asignar. La administracion puede todos;
 * la coordinacion solo catequista y familia (S-19). Misma regla que la API.
 */
export function rolesAsignables(rolesPropios: readonly Rol[]): Rol[] {
  if (rolesPropios.includes("administracion")) return ["administracion", "coordinacion", "catequista", "familia", "supervision"];
  return ["catequista", "familia"];
}
