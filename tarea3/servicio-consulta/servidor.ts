// Servidor HTTP del servicio de consulta (spec 009, RF-902): `/graphql` con
// graphql-http sobre node:http y `/salud` para que scripts/demo.mjs sepa cuándo
// el servicio está listo.

import { createServer, type Server } from 'node:http';
import { createHandler } from 'graphql-http/lib/use/http';
import type { GraphQLSchema, ValidationRule } from 'graphql';

export const PUERTO_PREDETERMINADO = 4000;

export type Cabeceras = Record<string, string | string[] | undefined> | { get: (clave: string) => string | null };

export interface OpcionesServidor {
  esquema: GraphQLSchema;
  // Recibe las cabeceras de la petición y devuelve el contexto de los resolvers.
  // La autenticación no se rechaza aquí: un token ausente o inválido viaja en el
  // contexto para que el resolver responda con `extensions.codigo` (RF-906).
  crearContexto?: (cabeceras: Cabeceras) => Promise<unknown> | unknown;
  reglasValidacion?: readonly ValidationRule[];
}

// Las cabeceras llegan como objeto en node:http y como Headers en otros
// adaptadores; se normaliza para que el resto del servicio no lo note.
export function leerCabecera(cabeceras: Cabeceras, clave: string): string | undefined {
  if (typeof (cabeceras as { get?: unknown }).get === 'function') {
    return (cabeceras as { get: (clave: string) => string | null }).get(clave) ?? undefined;
  }
  const valor = (cabeceras as Record<string, string | string[] | undefined>)[clave];
  return Array.isArray(valor) ? valor[0] : valor;
}

export function crearServidor(opciones: OpcionesServidor): Server {
  const manejadorGraphql = createHandler({
    schema: opciones.esquema,
    context: opciones.crearContexto
      ? (peticion) => Promise.resolve(opciones.crearContexto!(peticion.headers)) as Promise<Record<string, unknown>>
      : undefined,
    validationRules: opciones.reglasValidacion,
  });

  return createServer((peticion, respuesta) => {
    const ruta = (peticion.url ?? '/').split('?')[0];

    if (ruta === '/salud') {
      respuesta
        .writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ estado: 'ok', servicio: 'servicio-consulta' }));
      return;
    }

    if (ruta === '/graphql') {
      manejadorGraphql(peticion, respuesta).catch(() => {
        if (!respuesta.headersSent) {
          respuesta.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        }
        respuesta.end(JSON.stringify({ errors: [{ message: 'Error interno del servicio de consulta' }] }));
      });
      return;
    }

    respuesta
      .writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ errors: [{ message: `Ruta no encontrada: ${ruta}` }] }));
  });
}
