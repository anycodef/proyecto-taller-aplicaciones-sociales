// Resolvers del contrato de consulta (spec 009, RF-902). Solo presentan: la
// autorizacion vive en compartido/auth.ts y las escrituras se delegan por gRPC
// en el servicio de P3, sin duplicar reglas de negocio (RF-904).

import type { MapaResolvers } from './esquema.ts';
import { exigirToken, type ContextoPeticion } from './contexto.ts';
import type { Contexto } from '../compartido/tipos.ts';

export interface DependenciasResolvers {
  // Las dependencias de datos y del cliente gRPC se suman en T009-23 y T009-26.
  marcador?: never;
}

export function crearResolvers(
  _dependencias: DependenciasResolvers = {}
): MapaResolvers<ContextoPeticion> {
  return {
    Query: {
      yo: (_origen, _argumentos, contexto): Contexto => {
        const token = exigirToken(contexto);
        return {
          identidadOperativa: token.identidadOperativa,
          rol: token.rol,
          grupoId: token.grupoId ?? null,
        };
      },
    },
  };
}
