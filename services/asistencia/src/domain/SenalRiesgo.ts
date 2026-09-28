import { cuentaComoFalta } from "./EstadoAsistencia";
import { RegistroAsistencia } from "./RegistroAsistencia";

export type NivelRiesgo = "bajo" | "medio" | "alto";

export type SenalRiesgo = {
  catequizandoId: string;
  nivel: NivelRiesgo;
  motivos: string[];
  calculadoEn: string;
};

/** A las dos faltas se conversa con el apoderado. */
export const UMBRAL_CONVERSACION = 2;
/** Con tres o más faltas se alcanza el umbral de retiro. */
export const UMBRAL_RETIRO = 3;

export function nivelSegunFaltas(faltas: number): NivelRiesgo {
  if (faltas >= UMBRAL_RETIRO) return "alto";
  if (faltas >= UMBRAL_CONVERSACION) return "medio";
  return "bajo";
}

/**
 * Calcula la señal de riesgo de un catequizando a partir de su historial.
 *
 * - Solo `ausente` cuenta como falta; `tardanza` y `justificado` no (ver `cuentaComoFalta`).
 * - Por si llegan dos registros del mismo catequizando para una misma sesión
 *   (p. ej. una corrección con otro id), solo vale el más reciente.
 * - 0–1 faltas → bajo; 2 → medio; 3 o más → alto.
 * - `motivos` explica el cálculo con los conteos que lo produjeron.
 */
export function calcularSenalRiesgo(
  catequizandoId: string,
  registros: readonly RegistroAsistencia[],
  ahora: Date,
): SenalRiesgo {
  const vigentes = registrosVigentesPorSesion(registros.filter((r) => r.catequizandoId === catequizandoId));

  const faltas = vigentes.filter((r) => cuentaComoFalta(r.estado)).length;
  const justificadas = vigentes.filter((r) => r.estado === "justificado").length;
  const tardanzas = vigentes.filter((r) => r.estado === "tardanza").length;

  const nivel = nivelSegunFaltas(faltas);
  const motivos = [
    faltas === 0
      ? "0 ausencias sin justificar"
      : `${faltas} ${faltas === 1 ? "ausencia" : "ausencias"} sin justificar`,
  ];
  if (justificadas > 0) {
    motivos.push(
      `${justificadas} ${justificadas === 1 ? "ausencia justificada" : "ausencias justificadas"} (no suman faltas)`,
    );
  }
  if (tardanzas > 0) {
    motivos.push(
      `${tardanzas} ${tardanzas === 1 ? "tardanza" : "tardanzas"} (cuenta como asistencia)`,
    );
  }
  if (nivel === "medio") motivos.push("A las 2 faltas se conversa con el apoderado");
  if (nivel === "alto") motivos.push("Alcanza el umbral de retiro (3 o más faltas)");

  return { catequizandoId, nivel, motivos, calculadoEn: ahora.toISOString() };
}

/** Un registro por sesión: si hay varios, el más reciente. */
export function registrosVigentesPorSesion(registros: readonly RegistroAsistencia[]): RegistroAsistencia[] {
  const porSesion = new Map<string, RegistroAsistencia>();
  for (const registro of registros) {
    const previo = porSesion.get(registro.sesionId);
    if (!previo || registro.registradoEn >= previo.registradoEn) porSesion.set(registro.sesionId, registro);
  }
  return [...porSesion.values()];
}
