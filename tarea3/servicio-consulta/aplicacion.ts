// Ensamblado del servicio de consulta: contrato + resolvers + contexto.
// Lo usan por igual index.ts y las pruebas, para que nadie pruebe un cableado
// distinto del que corre en la demo.

import { aplicarResolvers, construirEsquema } from './esquema.ts';
import { crearContexto, type ContextoPeticion } from './contexto.ts';
import { crearResolvers, type DependenciasResolvers } from './resolvers.ts';
import type { OpcionesServidor } from './servidor.ts';

export type { ContextoPeticion };

export function crearAplicacion(dependencias: DependenciasResolvers = {}): OpcionesServidor {
  const esquema = construirEsquema();
  aplicarResolvers(esquema, crearResolvers(dependencias));
  return { esquema, crearContexto };
}
