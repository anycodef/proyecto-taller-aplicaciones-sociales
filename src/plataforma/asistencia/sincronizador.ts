import { aplicarPull, filasDe, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import {
  aplicarResultadoPush,
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
  /** Filas que el servidor rechazo. */
  rechazados: number;
  /** Filas que llegaron cuando el ciclo ya estaba cerrado. */
  descartadosCierre: number;
  /** Pendientes que quedan en el celular. */
  pendientes: number;
  /** Si se logro bajar la nomina. */
  nominaActualizada: boolean;
  /** Identificadores enviados en este push. */
  idsEnviados: string[];
};

export type OpcionesSincronizacion = {
  almacen: AlmacenLocal;
  cliente: ClienteSync;
  /** Si es false, solo se envia lo pendiente. */
  pulling?: boolean;
};

/**
 * Baja la nomina y envia lo pendiente. El push lleva ids deterministas y el
 * servidor ignora los repetidos, asi que reenviar no duplica marcas
 * (RF-307). Si el servidor rechaza algo, se conserva en el celular para el
 * siguiente intento.
 *
 * No guarda: devuelve el estado resultante y quien lo llama decide, para que
 * una marca registrada durante el push no se pierda.
 */
export async function sincronizar(
  opciones: OpcionesSincronizacion
): Promise<{ estado: AlmacenLocal; resultado: ResultadoSincronizacion }> {
  const { almacen, cliente } = opciones;
  let estado = almacen;
  let nominaActualizada = false;

  if (opciones.pulling !== false) {
    try {
      const pull = await cliente.solicitar<RespuestaPull>("GET", "/sincronizacion/cambios");
      estado = aplicarPull(estado, pull);
      nominaActualizada = true;
    } catch {
      // Sin red el pull falla: se conservan lo ya descargado.
    }
  }

  const pendientes = resumenPendientes(estado.pendientes);
  if (pendientes.total === 0) {
    return {
      estado,
      resultado: {
        aceptados: 0,
        rechazados: 0,
        descartadosCierre: 0,
        pendientes: 0,
        nominaActualizada,
        idsEnviados: [],
      },
    };
  }

  const lote = prepararLote(estado.pendientes);
  const idsEnviados = [
    ...estado.pendientes.marcas.map((marca) => marca.id),
    ...estado.pendientes.listas.map((lista) => lista.id),
  ];

  let resumen: ResultadoPush = { aceptados: 0, rechazados: 0, descartadosCierre: 0 };

  try {
    resumen = await cliente.solicitar<ResultadoPush>("POST", "/sincronizacion/cambios", {
      changes: lote,
    });
  } catch {
    // Sin red el push falla: las marcas siguen en el celular.
    return {
      estado,
      resultado: {
        aceptados: 0,
        rechazados: 0,
        descartadosCierre: 0,
        pendientes: pendientes.total,
        nominaActualizada,
        idsEnviados: [],
      },
    };
  }

  if (resumen.rechazados === 0) {
    estado = {
      ...estado,
      pendientes: aplicarResultadoPush(estado.pendientes, idsEnviados),
    };
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
