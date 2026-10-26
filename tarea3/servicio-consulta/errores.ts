// Traduccion de los errores de gRPC a `extensions.codigo` (spec 009, RF-906,
// RF-907).
//
// El contrato MCP dice que una violacion de rol o alcance devuelve
// `fuera_de_alcance` y «nunca el detalle interno». Por eso el mensaje que sale
// de aqui es fijo por codigo y nunca se reenvia el de gRPC: el del servicio de
// actualizacion puede traer, en un fallo inesperado, texto de PostgreSQL con
// nombres de columna o valores de la fila.

import * as grpc from '@grpc/grpc-js';
import { GraphQLError } from 'graphql';

export type CodigoError =
  | 'fuera_de_alcance'
  | 'no_encontrado'
  | 'entrada_invalida'
  | 'servicio_no_disponible'
  | 'error_interno';

interface Traduccion {
  codigo: CodigoError;
  mensaje: string;
}

const POR_ESTADO_GRPC = new Map<grpc.status, Traduccion>([
  [
    grpc.status.PERMISSION_DENIED,
    { codigo: 'fuera_de_alcance', mensaje: 'El rol no alcanza a realizar esta operacion' },
  ],
  [
    grpc.status.UNAUTHENTICATED,
    { codigo: 'fuera_de_alcance', mensaje: 'Se requiere un token de demostracion valido' },
  ],
  [
    grpc.status.NOT_FOUND,
    { codigo: 'no_encontrado', mensaje: 'El registro indicado no existe' },
  ],
  [
    grpc.status.INVALID_ARGUMENT,
    { codigo: 'entrada_invalida', mensaje: 'La entrada no cumple el contrato' },
  ],
  [
    grpc.status.FAILED_PRECONDITION,
    { codigo: 'entrada_invalida', mensaje: 'La operacion no es valida en el estado actual' },
  ],
  [
    grpc.status.UNAVAILABLE,
    {
      codigo: 'servicio_no_disponible',
      mensaje: 'El servicio de actualizacion no esta disponible',
    },
  ],
  [
    grpc.status.DEADLINE_EXCEEDED,
    { codigo: 'servicio_no_disponible', mensaje: 'El servicio de actualizacion tardo demasiado' },
  ],
]);

const DESCONOCIDO: Traduccion = {
  codigo: 'error_interno',
  mensaje: 'El servicio de actualizacion no pudo completar la operacion',
};

export function traducirEstadoGrpc(estado: unknown): Traduccion {
  if (typeof estado !== 'number') return DESCONOCIDO;
  return POR_ESTADO_GRPC.get(estado) ?? DESCONOCIDO;
}

export function traducirErrorGrpc(error: unknown): GraphQLError {
  // Un GraphQLError nuestro (UUID mal formado, nivel desconocido) ya viene
  // traducido: se deja pasar.
  if (error instanceof GraphQLError) return error;

  const { codigo, mensaje } = traducirEstadoGrpc((error as { code?: unknown })?.code);
  return new GraphQLError(mensaje, { extensions: { codigo } });
}

// Envuelve una llamada al servicio de actualizacion para que ningun error de
// gRPC salga en crudo por GraphQL.
export async function delegar<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    throw traducirErrorGrpc(error);
  }
}
