import type { AusenciaJustificable } from "./cliente-justificaciones";

export const claveAusencia = (a: Pick<AusenciaJustificable, "catequizandoId" | "sesionId">): string => `${a.catequizandoId}|${a.sesionId}`;

/** Alterna una ausencia en la selección sin mutar el conjunto anterior. */
export function alternarSeleccion(seleccion: ReadonlySet<string>, clave: string): Set<string> {
  const siguiente = new Set(seleccion);
  if (siguiente.has(clave)) siguiente.delete(clave);
  else siguiente.add(clave);
  return siguiente;
}

export type FilaDeNino = { catequizandoId: string; nombre: string; ausencias: AusenciaJustificable[] };

/** Agrupa por niño y ordena por fecha: la familia justifica varias ausencias de uno o varios hijos a la vez. */
export function agruparPorNino(ausencias: readonly AusenciaJustificable[]): FilaDeNino[] {
  const filas = new Map<string, FilaDeNino>();
  for (const a of ausencias) {
    const fila = filas.get(a.catequizandoId) ?? { catequizandoId: a.catequizandoId, nombre: a.nombre, ausencias: [] };
    fila.ausencias.push(a);
    filas.set(a.catequizandoId, fila);
  }
  return [...filas.values()]
    .map((fila) => ({ ...fila, ausencias: [...fila.ausencias].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.tipoSesion.localeCompare(y.tipoSesion)) }))
    .sort((x, y) => x.nombre.localeCompare(y.nombre));
}

/** Las seleccionadas que siguen disponibles; si el servidor ya no las ofrece, se descartan. */
export function seleccionadas(ausencias: readonly AusenciaJustificable[], seleccion: ReadonlySet<string>): AusenciaJustificable[] {
  return ausencias.filter((a) => seleccion.has(claveAusencia(a)));
}

export type EstadoFormulario = { cantidadAusencias: number; tieneCausa: boolean; tieneFoto: boolean };

/** El botón Enviar se habilita solo con ausencia, causa y foto (RF-401, RF-402). */
export function puedeEnviar(estado: EstadoFormulario): boolean {
  return estado.cantidadAusencias > 0 && estado.tieneCausa && estado.tieneFoto;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** `2026-11-08` -> `8 nov`; la fecha civil se interpreta sin zona para no correrla un día. */
export function fechaCorta(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return fecha;
  return `${Number(partes[3])} ${MESES[Number(partes[2]) - 1]}`;
}

export const etiquetaSesion = (tipo: string): string => (tipo === "misa" ? "Misa" : tipo === "catequesis" ? "Catequesis" : "Actividad");
