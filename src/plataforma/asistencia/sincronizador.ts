import { aplicarPull, filasDe, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import {
  aplicarResultadoPush,
  idsPendientes,
  prepararLote,
  resumenPendientes,
  type ResultadoPush,
} from "@/lib/asistencia/pendientes";
import type { RespuestaPull } from "@/lib/sincronizacion/protocolo";

export type ClienteSync = {
  solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T>;
};

export type ResultadoSincronizacion = {
  /** Filas que el servidor confirmo. */
  aceptados: number;
  /** Filas que el servidor guardo como rechazadas, con su motivo. */
  rechazados: number;
  /** Filas que llegaron cuando el ciclo ya estaba cerrado. */
  descartadosCierre: number;
  /** Pendientes que quedan en el celular. */
  pendientes: number;
  /** Si se logro bajar la nomina. */
  nominaActualizada: boolean;
  /** Identificadores que el servidor ya guardo en este push. */
  idsEnviados: string[];
};

export type OpcionesSincronizacion = {
  almacen: AlmacenLocal;
  cliente: ClienteSync;
  /** Si es false, solo se envia lo pendiente. */
  pulling?: boolean;
  /** Reloj inyectable para el resumen del push. */
  ahora?: () => number;
};

/** Ruta del pull: con el pulso y la huella, el servidor responde solo lo que cambio. */
export function rutaPull(almacen: AlmacenLocal): string {
  if (almacen.ultimoPulso === null || !almacen.huellaAlcance) return "/sincronizacion/cambios";
  const consulta = `ultimoPulso=${almacen.ultimoPulso}&huellaAlcance=${encodeURIComponent(almacen.huellaAlcance)}`;
  return `/sincronizacion/cambios?${consulta}`;
}

async function bajar(estado: AlmacenLocal, cliente: ClienteSync): Promise<AlmacenLocal | null> {
  try {
    const pull = await cliente.solicitar<RespuestaPull>("GET", rutaPull(estado));
    return aplicarPull(estado, pull);
  } catch {
    // Sin red el pull falla: se conserva lo ya descargado.
    return null;
  }
}

/**
 * Baja la nomina y envia lo pendiente. El push lleva ids deterministas y el
 * servidor ignora los repetidos, asi que reenviar no duplica marcas
 * (RF-307).
 *
 * Una respuesta 200 del push significa que el servidor guardo cada fila en la
 * misma transaccion, aceptada o rechazada con su motivo. Por eso todo lo
 * enviado sale de pendientes: reenviar una fila rechazada solo la volveria a
 * rechazar y el contador nunca bajaria. Los rechazados vuelven en el pull con
 * su estado y quedan visibles en «Por enviar» (RF-303).
 *
 * No guarda: devuelve el estado resultante y quien lo llama decide, para que
 * una marca registrada durante el push no se pierda.
 */
export async function sincronizar(
  opciones: OpcionesSincronizacion
): Promise<{ estado: AlmacenLocal; resultado: ResultadoSincronizacion }> {
  const { almacen, cliente } = opciones;
  const ahora = opciones.ahora ?? Date.now;
  let estado = almacen;
  let nominaActualizada = false;

  if (opciones.pulling !== false) {
    const bajado = await bajar(estado, cliente);
    if (bajado) {
      estado = bajado;
      nominaActualizada = true;
    }
  }

  const pendientes = resumenPendientes(estado.pendientes);
  const sinEnviar = (): ResultadoSincronizacion => ({
    aceptados: 0,
    rechazados: 0,
    descartadosCierre: 0,
    pendientes: pendientes.total,
    nominaActualizada,
    idsEnviados: [],
  });
  if (pendientes.total === 0) return { estado, resultado: sinEnviar() };

  const lote = prepararLote(estado.pendientes);
  const idsEnviados = idsPendientes(estado.pendientes);

  let resumen: ResultadoPush;
  try {
    resumen = await cliente.solicitar<ResultadoPush>("POST", "/sincronizacion/cambios", {
      changes: lote,
    });
  } catch {
    // Sin red, o el servidor no acepto el lote entero: todo sigue en el celular.
    return { estado, resultado: sinEnviar() };
  }

  estado = {
    ...estado,
    pendientes: aplicarResultadoPush(estado.pendientes, idsEnviados),
    ultimoResumen: {
      aceptados: resumen.aceptados,
      rechazados: resumen.rechazados,
      descartadosCierre: resumen.descartadosCierre,
      en: ahora(),
    },
  };

  // Un segundo pull trae lo que el servidor consolido: la lista ya confirmada,
  // las marcas aceptadas y las rechazadas con su motivo.
  if (opciones.pulling !== false) {
    const bajado = await bajar(estado, cliente);
    if (bajado) estado = bajado;
  }

  return {
    estado,
    resultado: {
      aceptados: resumen.aceptados,
      rechazados: resumen.rechazados,
      descartadosCierre: resumen.descartadosCierre,
      pendientes: resumenPendientes(estado.pendientes).total,
      nominaActualizada,
      idsEnviados,
    },
  };
}

/** Ninos de un grupo que ya estan en la nomina local. */
export function ninosDelGrupo(almacen: AlmacenLocal, grupoId: string) {
  return filasDe(almacen, "catequizandos").filter(
    (fila) => fila.grupo_id === grupoId && fila.activo !== false
  );
}
