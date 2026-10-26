// Ensamblado del servicio de consulta: contrato + resolvers + contexto.
// Lo usan por igual index.ts y las pruebas, para que nadie pruebe un cableado
// distinto del que corre en la demo.

import { aplicarResolvers, construirEsquema } from './esquema.ts';
import { crearFabricaDeContexto, type ContextoPeticion } from './contexto.ts';
import { crearResolvers, type DependenciasResolvers } from './resolvers.ts';
import { reglaDeProfundidad } from './profundidad.ts';
import type { Datos } from './datos.ts';
import type { OpcionesServidor } from './servidor.ts';

export type { ContextoPeticion };

export interface DependenciasServicio extends DependenciasResolvers {
  datos: Datos;
}

export type { DependenciasResolvers };

export function crearAplicacion(dependencias: DependenciasServicio): OpcionesServidor {
  const esquema = construirEsquema();
  aplicarResolvers(esquema, crearResolvers(dependencias));
  return {
    esquema,
    crearContexto: crearFabricaDeContexto(dependencias.datos),
    reglasValidacion: [reglaDeProfundidad()],
  };
}
