// Utilidades comunes de las pruebas de P2: levantan el servidor en un puerto
// libre para no chocar con el 4000 de la demo y hablan GraphQL por HTTP real.

import type { AddressInfo } from 'node:net';
import { crearServidor, type OpcionesServidor } from '../servidor.ts';
import { crearDatos, type Datos, type EjecutorSql } from '../datos.ts';
import type { ClienteActualizacion } from '../cliente-grpc.ts';

// Ejecutor SQL de mentira que apunta cada consulta recibida: con el se cuenta
// el numero de idas a la base y se demuestra que el cargador evita el N+1.
export interface EjecutorEspia extends EjecutorSql {
  consultas: { texto: string; valores: unknown[] }[];
}

export function crearEjecutorEspia(
  responder: (texto: string, valores: unknown[]) => Record<string, unknown>[]
): EjecutorEspia {
  const consultas: { texto: string; valores: unknown[] }[] = [];
  return {
    consultas,
    async query(texto, valores = []) {
      consultas.push({ texto, valores });
      return { rows: responder(texto, valores) };
    },
  };
}

// Para las pruebas que no tocan datos: cualquier consulta es un error de prueba.
export function datosSinBase(): Datos {
  return crearDatos({
    query: () => {
      throw new Error('esta prueba no deberia consultar la base de datos');
    },
  });
}

// Para las pruebas de consulta: llamar al servicio de actualizacion seria un
// error, porque leer nunca debe escribir.
export function clienteSinGrpc(): ClienteActualizacion {
  const fallar = () => {
    throw new Error('esta prueba no deberia llamar al servicio de actualizacion');
  };
  return {
    registrarAsistencia: fallar,
    registrarJustificacion: fallar,
    recalcularRiesgo: fallar,
    cerrar: () => {},
  };
}

export interface ServidorDePrueba {
  url: string;
  urlSalud: string;
  consultar: (
    consulta: string,
    variables?: Record<string, unknown>,
    token?: string
  ) => Promise<{ estado: number; cuerpo: RespuestaGraphql }>;
  cerrar: () => Promise<void>;
}

export interface RespuestaGraphql {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions?: { codigo?: string } }[];
}

export async function levantarServidor(opciones: OpcionesServidor): Promise<ServidorDePrueba> {
  const servidor = crearServidor(opciones);
  await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const { port } = servidor.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/graphql`;

  return {
    url,
    urlSalud: `http://127.0.0.1:${port}/salud`,
    async consultar(consulta, variables = {}, token) {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: consulta, variables }),
      });
      return { estado: respuesta.status, cuerpo: (await respuesta.json()) as RespuestaGraphql };
    },
    cerrar() {
      return new Promise<void>((resolver) => servidor.close(() => resolver()));
    },
  };
}
