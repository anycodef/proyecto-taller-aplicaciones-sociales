export const ESTADOS_ASISTENCIA = ["presente", "tardanza", "ausente", "justificado"] as const;

export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

export function esEstadoAsistencia(valor: unknown): valor is EstadoAsistencia {
  return typeof valor === "string" && (ESTADOS_ASISTENCIA as readonly string[]).includes(valor);
}

/**
 * Regla del trabajo de campo (SPEC §3): solo `ausente` cuenta como falta.
 * `tardanza` cuenta como asistencia (la parroquia valida la llegada a las 8:00)
 * y `justificado` no suma faltas.
 */
export function cuentaComoFalta(estado: EstadoAsistencia): boolean {
  return estado === "ausente";
}
