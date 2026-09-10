import type { RegistroAsistencia } from "@/lib/domain/modelo";

/**
 * Cola de sincronizacion diferida (modelo offline-first).
 *
 * En el local la senal no llega del primer al tercer piso, asi que el
 * registro de asistencia se guarda en el dispositivo y se envia cuando la
 * conexion vuelve. La cola es independiente del flujo principal: la
 * catequista termina de pasar lista aunque nunca haya red.
 */

export type EstadoEnvio = "pendiente" | "enviando" | "confirmado" | "fallido";

export type ItemCola = {
  /** Id generado en el cliente; permite escritura idempotente en el servidor. */
  id: string;
  registro: RegistroAsistencia;
  estado: EstadoEnvio;
  intentos: number;
  creadoEn: string;
  ultimoError?: string;
};

export interface AlmacenCola {
  listar(): Promise<ItemCola[]>;
  guardar(item: ItemCola): Promise<void>;
  eliminar(id: string): Promise<void>;
}

/** Espera creciente entre reintentos, con tope para no castigar la bateria. */
export function esperaReintento(intentos: number): number {
  const base = 2_000;
  const tope = 5 * 60_000;
  return Math.min(base * 2 ** intentos, tope);
}

export async function encolar(
  almacen: AlmacenCola,
  registro: RegistroAsistencia,
): Promise<ItemCola> {
  const item: ItemCola = {
    id: registro.id,
    registro,
    estado: "pendiente",
    intentos: 0,
    creadoEn: new Date().toISOString(),
  };
  await almacen.guardar(item);
  return item;
}

/**
 * Vacia la cola contra el servidor. Devuelve cuantos items quedaron
 * pendientes, para que la interfaz pueda mostrarlo sin bloquear nada.
 */
export async function sincronizar(
  almacen: AlmacenCola,
  enviar: (registro: RegistroAsistencia) => Promise<void>,
): Promise<{ confirmados: number; pendientes: number }> {
  const items = await almacen.listar();
  let confirmados = 0;

  for (const item of items) {
    if (item.estado === "confirmado") continue;
    try {
      await enviar(item.registro);
      await almacen.eliminar(item.id);
      confirmados += 1;
    } catch (error) {
      await almacen.guardar({
        ...item,
        estado: "fallido",
        intentos: item.intentos + 1,
        ultimoError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const restantes = await almacen.listar();
  return { confirmados, pendientes: restantes.length };
}
