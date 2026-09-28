import { ErrorDeValidacion } from "./errores";

export const TIPOS_SESION = ["misa", "catequesis"] as const;

export type TipoSesion = (typeof TIPOS_SESION)[number];

export type SesionCatequesis = {
  id: string;
  grupoId: string;
  fecha: string; // YYYY-MM-DD
  /** [PROPUESTA] no existe en modelo.ts (SPEC §3). */
  tipo: TipoSesion;
  tema?: string;
};

export function esTipoSesion(valor: unknown): valor is TipoSesion {
  return typeof valor === "string" && (TIPOS_SESION as readonly string[]).includes(valor);
}

/** `YYYY-MM-DD` y que exista en el calendario (rechaza 2026-02-30). */
export function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

export function textoNoVacio(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErrorDeValidacion(`${campo} es obligatorio y no puede estar vacío`);
  }
  return valor.trim();
}

/** Crea una sesión validando sus invariantes. */
export function crearSesion(datos: {
  id: unknown;
  grupoId: unknown;
  fecha: unknown;
  tipo: unknown;
  tema?: unknown;
}): SesionCatequesis {
  const id = textoNoVacio(datos.id, "sesion.id");
  const grupoId = textoNoVacio(datos.grupoId, "sesion.grupoId");
  const fecha = textoNoVacio(datos.fecha, "sesion.fecha");
  if (!esFechaValida(fecha)) {
    throw new ErrorDeValidacion("sesion.fecha debe tener formato YYYY-MM-DD y ser una fecha real");
  }
  if (!esTipoSesion(datos.tipo)) {
    throw new ErrorDeValidacion(`sesion.tipo debe ser uno de: ${TIPOS_SESION.join(", ")}`);
  }
  const sesion: SesionCatequesis = { id, grupoId, fecha, tipo: datos.tipo };
  if (datos.tema !== undefined) {
    if (typeof datos.tema !== "string") throw new ErrorDeValidacion("sesion.tema debe ser texto");
    if (datos.tema.trim() !== "") sesion.tema = datos.tema.trim();
  }
  return sesion;
}
