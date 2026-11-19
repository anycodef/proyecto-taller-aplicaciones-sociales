import { fechaCorta } from "@/lib/justificaciones/seleccion";
import type { EstadoRiesgo, Paso } from "./tipos";

export type EntradaExplicable = Pick<EstadoRiesgo, "paso" | "conteo" | "sinFicha" | "pendientesJustificar" | "faltasOrigen">;

export type Explicacion = {
  /** Nombre del paso: «Alerta de retiro», «Citación», «Contacto», «Seguimiento». */
  titulo: string;
  /** Qué faltas originaron el paso (RNF-702). */
  motivo: string;
  /** Qué debe hacer la coordinación o el catequista; vacío cuando no hay acción. */
  siguientePaso: string | null;
  /** Faltas que todavía no suman y por qué. */
  pendientes: string | null;
};

const TITULOS: Record<Paso, string> = {
  alerta_retiro: "Alerta de retiro",
  citacion: "Citación",
  contacto: "Contacto",
  seguimiento: "Seguimiento",
  sin_riesgo: "Sin riesgo",
  retirado: "Retirado",
};

export const tituloDePaso = (paso: Paso): string => TITULOS[paso];

const faltas = (n: number): string => `${n} ${n === 1 ? "falta" : "faltas"}`;

function fechasQueSuman(entrada: EntradaExplicable): string {
  const suman = entrada.faltasOrigen.filter((falta) => falta.estado === "suma");
  const conFecha = suman.filter((falta) => falta.origen !== "papel").map((falta) => falta.fecha).sort();
  const deLaPapel = suman.filter((falta) => falta.origen === "papel").reduce((total, falta) => total + (falta.cantidad ?? 1), 0);
  const partes = [...conFecha.map(fechaCorta), ...(deLaPapel > 0 ? [`${faltas(deLaPapel)} del saldo cargado desde papel`] : [])];
  return partes.length ? ` (${partes.join(", ")})` : "";
}

function describirPendientes(entrada: EntradaExplicable): string | null {
  const pendientes = entrada.faltasOrigen.filter((falta) => falta.estado === "pendiente_justificar").length;
  const enRevision = entrada.faltasOrigen.filter((falta) => falta.estado === "en_revision").length;
  const partes: string[] = [];
  const porJustificar = pendientes || (enRevision === 0 ? entrada.pendientesJustificar : 0);
  if (porJustificar > 0) partes.push(`${faltas(porJustificar)} pendiente${porJustificar === 1 ? "" : "s"} de justificar: aún no ${porJustificar === 1 ? "suma" : "suman"}`);
  if (enRevision > 0) partes.push(`${faltas(enRevision)} con la justificación en revisión: no ${enRevision === 1 ? "suma" : "suman"} hasta que se decida`);
  return partes.length ? partes.join(". ") : null;
}

/**
 * Traduce el paso calculado en el servidor a un texto que dice por qué está ahí y qué sigue.
 * No recalcula nada: el celular solo explica lo que la API ya decidió (spec 007, RNF-702).
 */
export function explicarPaso(entrada: EntradaExplicable): Explicacion {
  const detalle = fechasQueSuman(entrada);
  const pendientes = describirPendientes(entrada);
  switch (entrada.paso) {
    case "alerta_retiro":
      return {
        titulo: TITULOS.alerta_retiro,
        motivo: `${faltas(entrada.conteo)} sin justificar${detalle}${entrada.sinFicha ? " y sin ficha de compromiso firmada" : ""}`,
        siguientePaso: "La coordinación decide el retiro; no se retira de forma automática.",
        pendientes,
      };
    case "citacion":
      return {
        titulo: TITULOS.citacion,
        motivo: `${faltas(entrada.conteo)}${detalle} y sin ficha de compromiso firmada`,
        siguientePaso: "Citar al apoderado y firmar la ficha de compromiso (coordinación).",
        pendientes,
      };
    case "contacto":
      return {
        titulo: TITULOS.contacto,
        motivo: `${faltas(entrada.conteo)} sin justificar${detalle}`,
        siguientePaso: "Contactar al apoderado (catequista del grupo y coordinación).",
        pendientes,
      };
    case "seguimiento":
      return {
        titulo: TITULOS.seguimiento,
        motivo: `${faltas(entrada.conteo)}${detalle} y con ficha de compromiso firmada`,
        siguientePaso: "Seguir la asistencia en los próximos domingos.",
        pendientes,
      };
    default:
      return { titulo: TITULOS[entrada.paso], motivo: entrada.conteo > 0 ? `${faltas(entrada.conteo)}${detalle}` : "Sin faltas que sumen", siguientePaso: null, pendientes };
  }
}
