import { edadAlInicioDelCiclo, estaEnRangoCatequesis } from "./edad";
export const CAMPOS_OBLIGATORIOS = ["nombres", "apellidos", "fechaNacimiento", "sexo", "bautizado", "apoderados", "consentimiento"] as const;
export function validarInscripcion(datos: { nombres?: string; apellidos?: string; fechaNacimiento?: string; sexo?: string; bautizado?: boolean; apoderados?: { valorContacto?: string }[]; consentimiento?: unknown; edadFueraRangoConfirmada?: boolean }, contexto: { inicioCiclo: string }): { bloqueos: string[]; advertencias: string[] } {
  const bloqueos: string[] = [];
  if (!datos.nombres?.trim() || !datos.apellidos?.trim() || !datos.fechaNacimiento || !["femenino", "masculino"].includes(datos.sexo ?? "") || typeof datos.bautizado !== "boolean") bloqueos.push("datos_obligatorios");
  if (!datos.apoderados?.some(a => a.valorContacto?.trim())) bloqueos.push("sin_apoderado_con_contacto");
  if (!datos.consentimiento) bloqueos.push("sin_consentimiento");
  const advertencias: string[] = [];
  try { if (datos.fechaNacimiento && !estaEnRangoCatequesis(edadAlInicioDelCiclo(datos.fechaNacimiento, contexto.inicioCiclo)) && !datos.edadFueraRangoConfirmada) advertencias.push("edad_fuera_de_rango_sin_confirmar"); } catch { bloqueos.push("fecha_invalida"); }
  return { bloqueos, advertencias };
}
