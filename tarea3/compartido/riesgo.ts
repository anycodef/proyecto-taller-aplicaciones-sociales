// Regla pura de cálculo de riesgo (spec 009, plan §4, RF-908).
// 0-1 faltas consecutivas sin justificar -> BAJO; 2 -> MEDIO; >= 3 -> ALTO.
// Una falta justificada no cuenta y rompe la racha de faltas sin justificar.
// No recibe ni devuelve datos de salud, neurodivergencia ni documentos.

export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO';

export interface AsistenciaRiesgo {
  fecha: string; // AAAA-MM-DD
  estado: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADA' | 'TARDANZA';
}

export interface ResultadoRiesgo {
  nivel: NivelRiesgo;
  motivo: string;
}

export function calcularRiesgo(asistencias: AsistenciaRiesgo[]): ResultadoRiesgo {
  const ordenadas = [...asistencias].sort((a, b) => a.fecha.localeCompare(b.fecha));

  let rachaActual = 0;
  let rachaMaxima = 0;
  for (const asistencia of ordenadas) {
    if (asistencia.estado === 'AUSENTE') {
      rachaActual += 1;
      if (rachaActual > rachaMaxima) rachaMaxima = rachaActual;
    } else {
      // PRESENTE, TARDANZA o JUSTIFICADA rompen la racha de faltas sin justificar.
      rachaActual = 0;
    }
  }

  let nivel: NivelRiesgo;
  let motivo: string;
  if (rachaMaxima >= 3) {
    nivel = 'ALTO';
    motivo = `${rachaMaxima} faltas consecutivas sin justificar`;
  } else if (rachaMaxima === 2) {
    nivel = 'MEDIO';
    motivo = `${rachaMaxima} faltas consecutivas sin justificar`;
  } else {
    nivel = 'BAJO';
    motivo = rachaMaxima === 0 ? 'sin faltas sin justificar' : '1 falta sin justificar';
  }

  return { nivel, motivo };
}
