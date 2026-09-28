import { ErrorDeValidacion } from "./errores";

export type Consentimiento = {
  otorgadoPor: string;
  otorgadoEn: string; // ISO
  version: string; // versión del texto aceptado
  retencionHasta: string; // fecha desde la que el registro debe anonimizarse
};

const noVacio = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function instante(valor: string, campo: string): number {
  const t = Date.parse(valor);
  if (Number.isNaN(t)) throw new ErrorDeValidacion(`consentimiento.${campo} no es una fecha válida`);
  return t;
}

/**
 * Invariante 1: no existe catequizando sin consentimiento informado completo.
 * `otorgadoPor`, `otorgadoEn` y `version` no vacíos, y `retencionHasta` posterior a `otorgadoEn`.
 */
export function validarConsentimiento(c: Partial<Consentimiento> | null | undefined): Consentimiento {
  if (c === null || c === undefined || typeof c !== "object") {
    throw new ErrorDeValidacion("El consentimiento informado es obligatorio");
  }
  for (const campo of ["otorgadoPor", "otorgadoEn", "version", "retencionHasta"] as const) {
    if (!noVacio(c[campo])) {
      throw new ErrorDeValidacion(`consentimiento.${campo} es obligatorio`);
    }
  }
  const { otorgadoPor, otorgadoEn, version, retencionHasta } = c as Consentimiento;
  if (instante(retencionHasta, "retencionHasta") <= instante(otorgadoEn, "otorgadoEn")) {
    throw new ErrorDeValidacion("consentimiento.retencionHasta debe ser posterior a otorgadoEn");
  }
  return { otorgadoPor, otorgadoEn, version, retencionHasta };
}
