import { normalizarTexto } from "./normalizar";
import type { Fragmento, Fuente, ResultadoValidacion } from "./tipos";

function claveCita(documento: string, seccion: string): string {
  return normalizarTexto(`${documento} ${seccion}`);
}

function citasDe(texto: string): string[] {
  return [...texto.matchAll(/\[([^\]]+)\]/g)]
    .map((coincidencia) => coincidencia[1]?.trim() ?? "")
    .filter((cita) => cita.length > 0);
}

export function validarRespuesta(texto: string, fragmentos: Fragmento[]): ResultadoValidacion {
  const citas = citasDe(texto);
  if (citas.length === 0) return { valida: false, motivo: "sin_citas" };

  const permitidas = new Set(fragmentos.map((fragmento) => claveCita(fragmento.documento, fragmento.seccion)));
  if (citas.some((cita) => !permitidas.has(normalizarTexto(cita)))) {
    return { valida: false, motivo: "cita_inventada" };
  }

  const normalizada = normalizarTexto(texto);
  if (
    /\b\d{8}\b/.test(normalizada) ||
    /\b(?:dni|documento de identidad|telefono|direccion|correo electronico)\b/.test(normalizada)
  ) {
    return { valida: false, motivo: "dato_personal" };
  }

  if (/\b(?:yo|nosotros)\s+(?:la iglesia|el magisterio)\b|\bcomo (?:iglesia|magisterio)\b/.test(normalizada)) {
    return { valida: false, motivo: "autoridad_doctrinal" };
  }

  return { valida: true };
}

export function fuentesUsadas(texto: string, fragmentos: Fragmento[]): Fuente[] {
  const citas = new Set(citasDe(texto).map(normalizarTexto));
  const usadas = fragmentos.filter((fragmento) =>
    citas.has(normalizarTexto(`${fragmento.documento}, ${fragmento.seccion}`)),
  );

  return usadas.map(({ id, documento, seccion, fuente, licencia }) => ({
    id,
    documento,
    seccion,
    fuente,
    licencia,
  }));
}
