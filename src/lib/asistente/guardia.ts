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

/**
 * «receta» sola no es consejo médico (receta de ceviche): solo la receta médica, recetar y sus formas.
 * Medicamento, dosis, tratamiento, etc. siguen rechazándose.
 */
const PATRONES_CONSEJO = [
  /\b(?:diagnostico|diagnosticar|medicamentos?|dosis|receta medica|recetar|recetaron|receto|recetaste|tratamiento|terapia|psicologo|psiquiatra|depresion|ansiedad|suicidio)\b/,
  /\b(?:abogado|demanda|juicio|custodia|denuncia|consejo legal|asesoria legal)\b/,
  /\b(?:debo|deberia|puedo)\b[^.?!]*\b(?:tomar|suspender|dar|denunciar|demandar|operar)\b/,
];

/** Consulta sobre el seguimiento de alguien: faltas, asistencia, riesgo, notas, salud, contacto. */
const SEGUIMIENTO =
  /\b(?:faltas?|falto|faltaron|asistio|asistieron|asistencia|inasistencias?|riesgo|desercion|justifico|justificaron|justificaciones?|notas?|calificaciones?|salud|enfermedad|telefono|celular|direccion|vive|correo|conducta|comportamiento|como va|como le fue|como le va|como les fue)\b/;

/** «mi hijo», «el niño», «este alumno», «fulano»: una persona del grupo sin nombrarla. */
const REFERENCIA_A_PERSONA =
  /\b(?:mi hijo|mi hija|mis hijos|su hijo|su hija|el hijo de|la hija de|el nino|la nina|este nino|esta nina|ese nino|esa nina|el alumno|la alumna|este alumno|esta alumna|el catequizando|la catequizanda|fulano|fulana|mengano|mengana)\b/;

/**
 * Nombres frecuentes por si se escriben en minúscula. Incluye nombres bíblicos: no se rechazan por sí solos,
 * solo cuando además se pregunta por su seguimiento (faltas, asistencia, riesgo…).
 */
const NOMBRES_COMUNES = new Set([
  "juan", "maria", "pedro", "jose", "luis", "carlos", "ana", "rosa", "miguel", "diego", "sofia", "lucia", "andrea", "camila",
  "mateo", "sebastian", "valeria", "daniel", "david", "pablo", "sara", "elena", "kevin", "bruno", "wilson", "luz", "jorge",
  "fernando", "gabriel", "rafael", "angel", "alejandro", "isabella", "valentina", "renata",
]);

/** Palabras con mayúscula que no son personas del grupo: doctrina, liturgia, calendario y lugares. */
const NO_PERSONAS = new Set([
  "dios", "jesus", "cristo", "iglesia", "biblia", "evangelio", "eucaristia", "bautismo", "confirmacion", "penitencia", "reconciliacion",
  "matrimonio", "orden", "uncion", "santo", "santa", "san", "padre", "nuestro", "espiritu", "virgen", "senor", "papa", "vaticano",
  "misa", "catequesis", "navidad", "pascua", "semana", "resurreccion", "antiguo", "nuevo", "testamento", "pentecostes", "trinidad",
  "ave", "credo", "gloria", "angelus", "rosario", "adviento", "cuaresma", "domingo", "lunes", "martes", "miercoles", "jueves",
  "viernes", "sabado", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
  "noviembre", "diciembre", "peru", "lima", "sigecat", "nazaret", "belen", "jerusalen", "galilea", "israel", "roma",
]);

const CAPITALIZADA = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/;

/** Una persona concreta: nombre propio (con mayúscula o de la lista) o una referencia como «mi hijo». */
function mencionaPersonaConcreta(original: string, normalizada: string): boolean {
  if (REFERENCIA_A_PERSONA.test(normalizada)) return true;
  if (normalizada.split(" ").some((palabra) => NOMBRES_COMUNES.has(palabra))) return true;
  const palabras = original.split(/\s+/).map((palabra) => palabra.replace(/^[¿¡("'«]+|[?!.,;:)"'»]+$/g, ""));
  return palabras.some((palabra, indice) => indice > 0 && CAPITALIZADA.test(palabra) && !NO_PERSONAS.has(normalizarTexto(palabra)));
}

export function evaluarGuardia(pregunta: string): EvaluacionGuardia {
  const normalizada = normalizarTexto(pregunta);

  if (PATRONES_DATOS.some((patron) => patron.test(normalizada)) || (SEGUIMIENTO.test(normalizada) && mencionaPersonaConcreta(pregunta, normalizada))) {
    return { permitida: false, motivo: "datos_personales", mensaje: MENSAJE_RECHAZO_DATOS };
  }

  if (PATRONES_CONSEJO.some((patron) => patron.test(normalizada))) {
    return { permitida: false, motivo: "consejo_profesional", mensaje: MENSAJE_RECHAZO_CONSEJO };
  }

  return { permitida: true };
}
