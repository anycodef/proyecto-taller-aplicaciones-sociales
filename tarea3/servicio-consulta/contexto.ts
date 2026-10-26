// Contexto de cada peticion GraphQL (spec 009, RF-906).
//
// El token no se rechaza en el transporte: se verifica aqui y, si falta o es
// invalido, el contexto queda sin token y el resolver responde con
// `extensions.codigo`. Asi el agente de P4 recibe 200 con el codigo del contrato
// en vez de un 401 opaco que su cliente traduciria a `error_interno`.

import { GraphQLError } from 'graphql';
import { verificarToken, type TokenPayload } from '../compartido/auth.ts';
import { leerCabecera, type Cabeceras } from './servidor.ts';

export interface ContextoPeticion {
  token: TokenPayload | null;
  // Para la traza local; nunca se devuelve al cliente (RF-907).
  motivoSinToken: string | null;
}

const ROLES_VALIDOS = new Set(['COORD', 'CAT', 'FAM', 'SUP']);

// El contrato solo define `fuera_de_alcance` para las violaciones de rol o
// alcance, y es el unico codigo que el cliente MCP distingue; se usa tambien
// cuando el token falta o no verifica.
export function errorFueraDeAlcance(mensaje: string): GraphQLError {
  return new GraphQLError(mensaje, { extensions: { codigo: 'fuera_de_alcance' } });
}

export function errorEntradaInvalida(mensaje: string): GraphQLError {
  return new GraphQLError(mensaje, { extensions: { codigo: 'entrada_invalida' } });
}

function esTokenUtilizable(payload: TokenPayload): boolean {
  return (
    typeof payload?.identidadOperativa === 'string' &&
    payload.identidadOperativa.length > 0 &&
    typeof payload?.rol === 'string' &&
    ROLES_VALIDOS.has(payload.rol)
  );
}

export async function crearContexto(cabeceras: Cabeceras): Promise<ContextoPeticion> {
  const autorizacion = leerCabecera(cabeceras, 'authorization');
  if (!autorizacion) {
    return { token: null, motivoSinToken: 'sin cabecera authorization' };
  }

  const [esquema, valor] = autorizacion.split(' ');
  if (esquema?.toLowerCase() !== 'bearer' || !valor) {
    return { token: null, motivoSinToken: 'authorization no es Bearer' };
  }

  try {
    const payload = await verificarToken(valor);
    if (!esTokenUtilizable(payload)) {
      return { token: null, motivoSinToken: 'el token no trae rol ni identidadOperativa validos' };
    }
    return { token: payload, motivoSinToken: null };
  } catch {
    return { token: null, motivoSinToken: 'el token no verifica' };
  }
}

// Todo resolver empieza por aqui: sin token no se resuelve nada.
export function exigirToken(contexto: ContextoPeticion): TokenPayload {
  if (!contexto.token) {
    throw errorFueraDeAlcance('Se requiere un token de demostracion valido');
  }
  return contexto.token;
}
