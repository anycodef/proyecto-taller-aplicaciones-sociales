import type { Pendientes } from "@/lib/asistencia/pendientes";
import { PENDIENTES_VACIOS } from "@/lib/asistencia/pendientes";
import type { FilaSincronizada, RespuestaPull } from "./protocolo";

export type Coleccion = Record<string, FilaSincronizada>;

/**
 * Estado del celular: lo que bajo del servidor, lo que falta enviar y por
 * donde quedo la ultima sincronizacion. Es serializable para poder guardarlo
 * en disco tal cual (RNF-102, RNF-306).
 */
export type AlmacenLocal = {
  colecciones: Record<string, Coleccion>;
  pendientes: Pendientes;
  ultimoPulso: number | null;
  huellaAlcance: string | null;
};

export function almacenVacio(): AlmacenLocal {
  return {
    colecciones: {},
    pendientes: PENDIENTES_VACIOS,
    ultimoPulso: null,
    huellaAlcance: null,
  };
}

export function filasDe(almacen: AlmacenLocal, coleccion: string): FilaSincronizada[] {
  return Object.values(almacen.colecciones[coleccion] ?? {});
}

/**
 * Aplica la respuesta del pull. Con estrategia de reemplazo la coleccion
 * entera se rehace; si no, se agregan, actualizan y borran las filas que
 * indiquen.
 */
export function aplicarPull(almacen: AlmacenLocal, pull: RespuestaPull): AlmacenLocal {
  const colecciones: Record<string, Coleccion> = { ...almacen.colecciones };

  for (const [tabla, cambios] of Object.entries(pull.changes ?? {})) {
    const actual: Coleccion = { ...(colecciones[tabla] ?? {}) };

    if (pull.experimentalStrategy === "replacement") {
      for (const id of Object.keys(actual)) delete actual[id];
    }

    for (const fila of cambios.created ?? []) actual[fila.id] = { ...fila };
    for (const fila of cambios.updated ?? []) actual[fila.id] = { ...(actual[fila.id] ?? {}), ...fila };
    for (const id of cambios.deleted ?? []) delete actual[id];

    colecciones[tabla] = actual;
  }

  return {
    ...almacen,
    colecciones,
    ultimoPulso: pull.timestamp ?? almacen.ultimoPulso,
    huellaAlcance: pull.huellaAlcance ?? almacen.huellaAlcance,
  };
}

export function serializarAlmacen(almacen: AlmacenLocal): string {
  return JSON.stringify(almacen);
}

export function deserializarAlmacen(texto: string | null): AlmacenLocal {
  if (!texto) return almacenVacio();
  try {
    const leido = JSON.parse(texto) as Partial<AlmacenLocal>;
    return {
      colecciones: leido.colecciones ?? {},
      pendientes: { ...PENDIENTES_VACIOS, ...(leido.pendientes ?? {}) },
      ultimoPulso: leido.ultimoPulso ?? null,
      huellaAlcance: leido.huellaAlcance ?? null,
    };
  } catch {
    return almacenVacio();
  }
}
