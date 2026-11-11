import { normalizarTexto } from "./normalizar";
import type { EvaluacionGuardia } from "./tipos";

export const MENSAJE_RECHAZO_DATOS =
  "No puedo consultar datos de niños, familias, salud, documentos o riesgo. Contacta a la coordinación parroquial.";
export const MENSAJE_RECHAZO_CONSEJO =
  "No puedo dar diagnósticos ni consejo médico, legal o psicológico. Habla con un adulto responsable o con un profesional.";

const PATRONES_DATOS = [
  /\b(?:datos|informacion|informe|ficha|expediente|historial)\b[^.?!]*\b(?:nino|nina|menor|menores|catequizando|catequizanda|familia|apoderado|hijo|hija)\b/,
  /\b(?:nino|nina|menor|menores|catequizando|catequizanda|hijo|hija|apoderado|familia)\b[^.?!]*\b(?:salud|enfermedad|asistencia|falta|faltas|riesgo|desercion|documento|direccion|telefono|nota|conducta|situacion familiar)\b/,
  /\b(?:mi|mis)\s+(?:hijo|hija|nino|nina|familiar|apoderado)\b/,
  /\b(?:quien|quienes|que nino|que ninos|que catequizando|cual nino)\b[^.?!]*\b(?:riesgo|desercion|alerta de retiro|inasistencia)\b/,
  /\b(?:riesgo de desercion|alerta de retiro|lista de riesgo|estado de riesgo)\b/,
  /\b(?:dni|documento de identidad|partida de nacimiento|pasaporte|direccion|telefono|correo electronico|fotografia)\b/,
  /\b(?:situacion familiar|problema familiar|violencia|abuso|divorcio|separacion de los padres)\b/,
  /\b(?:datos|informacion)\s+(?:personal|privada|sensible)\b/,
];

const PATRONES_CONSEJO = [
  /\b(?:diagnostico|diagnosticar|medicamento|dosis|receta|tratamiento|terapia|psicologo|psiquiatra|depresion|ansiedad|suicidio)\b/,
  /\b(?:abogado|demanda|juicio|custodia|denuncia|consejo legal|asesoria legal)\b/,
  /\b(?:debo|deberia|puedo)\b[^.?!]*\b(?:tomar|suspender|dar|denunciar|demandar|operar)\b/,
];

export function evaluarGuardia(pregunta: string): EvaluacionGuardia {
  const normalizada = normalizarTexto(pregunta);

  if (PATRONES_DATOS.some((patron) => patron.test(normalizada))) {
    return { permitida: false, motivo: "datos_personales", mensaje: MENSAJE_RECHAZO_DATOS };
  }

  if (PATRONES_CONSEJO.some((patron) => patron.test(normalizada))) {
    return { permitida: false, motivo: "consejo_profesional", mensaje: MENSAJE_RECHAZO_CONSEJO };
  }

  return { permitida: true };
}
