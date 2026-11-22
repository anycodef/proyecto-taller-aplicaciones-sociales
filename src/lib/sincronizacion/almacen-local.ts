import type { Pendientes } from "@/lib/asistencia/pendientes";
import { PENDIENTES_VACIOS } from "@/lib/asistencia/pendientes";
import type { FilaSincronizada, RespuestaPull, ResumenPush } from "./protocolo";

export type Coleccion = Record<string, FilaSincronizada>;

/**
 * Estado del celular: lo que bajo del servidor, lo que falta enviar y por
 * donde quedo la ultima sincronizacion. Es serializable para poder guardarlo
 * en disco tal cual (RNF-102, RNF-306).
 */
/** Lo que respondio el ultimo push aceptado por el servidor (RF-303, A-312). */
export type UltimoResumenPush = ResumenPush & { en: number };

export type AlmacenLocal = {
  colecciones: Record<string, Coleccion>;
  pendientes: Pendientes;
  ultimoPulso: number | null;
  huellaAlcance: string | null;
  ultimoResumen: UltimoResumenPush | null;
};

export function almacenVacio(): AlmacenLocal {
  return {
    colecciones: {},
    pendientes: PENDIENTES_VACIOS,
    ultimoPulso: null,
    huellaAlcance: null,
    ultimoResumen: null,
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
      ultimoResumen: leido.ultimoResumen ?? null,
    };
  } catch {
    return almacenVacio();
  }
}

/** Colecciones que existen solo en el celular y nunca bajan del servidor. */
export const COLECCIONES_SOLO_LOCALES = ["borradores_lista"] as const;

/**
 * Lo que queda en el celular al cerrar sesion: solo los registros que la
 * cuenta aun no envio. La nomina, los grupos, las sesiones y los borradores se
 * borran; volveran a bajar en el siguiente inicio (RF-307, RNF-306, RNF-102).
 * El pulso se olvida para que el proximo pull sea de reemplazo.
 */
export function purgarExceptoPendientes(almacen: AlmacenLocal, cuentaId: string): AlmacenLocal {
  const deLaCuenta = <T extends { fila: { cuenta_id: string } }>(filas: T[]): T[] =>
    filas.filter((pendiente) => pendiente.fila.cuenta_id === cuentaId);
  return {
    ...almacenVacio(),
    pendientes: {
      marcas: deLaCuenta(almacen.pendientes.marcas),
      listas: deLaCuenta(almacen.pendientes.listas),
      correcciones: deLaCuenta(almacen.pendientes.correcciones),
      sesiones: deLaCuenta(almacen.pendientes.sesiones),
    },
  };
}

const mismaFila = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Junta el resultado de una sincronizacion con lo que el usuario hizo
 * mientras esperaba la red. Del resultado se toman las colecciones que el pull
 * cambio y los pendientes que el servidor ya guardo; del estado actual, todo lo
 * demas. Un pendiente que se volvio a guardar con otro contenido durante la
 * sincronizacion se conserva: el servidor recibio la version anterior.
 */
export function fusionarTrasSincronizar(
  antes: AlmacenLocal,
  resultado: AlmacenLocal,
  actual: AlmacenLocal
): AlmacenLocal {
  const colecciones: Record<string, Coleccion> = { ...actual.colecciones };
  for (const [nombre, coleccion] of Object.entries(resultado.colecciones)) {
    if (coleccion !== antes.colecciones[nombre]) colecciones[nombre] = coleccion;
  }

  const retirar = <T extends { id: string }>(enAntes: T[], enResultado: T[], enActual: T[]): T[] => {
    const siguen = new Set(enResultado.map((fila) => fila.id));
    const enviadas = new Map(enAntes.filter((fila) => !siguen.has(fila.id)).map((fila) => [fila.id, fila]));
    return enActual.filter((fila) => !enviadas.has(fila.id) || !mismaFila(fila, enviadas.get(fila.id)));
  };

  return {
    colecciones,
    pendientes: {
      marcas: retirar(antes.pendientes.marcas, resultado.pendientes.marcas, actual.pendientes.marcas),
      listas: retirar(antes.pendientes.listas, resultado.pendientes.listas, actual.pendientes.listas),
      correcciones: retirar(
        antes.pendientes.correcciones,
        resultado.pendientes.correcciones,
        actual.pendientes.correcciones
      ),
      sesiones: retirar(antes.pendientes.sesiones, resultado.pendientes.sesiones, actual.pendientes.sesiones),
    },
    ultimoPulso: resultado.ultimoPulso,
    huellaAlcance: resultado.huellaAlcance,
    ultimoResumen: resultado.ultimoResumen,
  };
}
