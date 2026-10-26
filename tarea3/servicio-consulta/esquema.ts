// Convierte el contrato congelado tarea3/contratos/schema.graphql en un esquema
// ejecutable (spec 009, RF-902).
//
// El SDL no puede declarar el comportamiento de un escalar ni asociar resolvers, y
// plan §3 no autoriza añadir @graphql-tools. Por eso ambas cosas se completan aquí
// sobre el esquema ya construido: así el contrato sigue siendo la única fuente de
// verdad y no se duplica el esquema en código.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSchema,
  GraphQLError,
  GraphQLScalarType,
  isObjectType,
  Kind,
  type GraphQLFieldResolver,
  type GraphQLSchema,
  type ValueNode,
} from 'graphql';

export const RUTA_CONTRATO = join(import.meta.dirname, '..', 'contratos', 'schema.graphql');

const PATRON_FECHA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

// Mapa de resolvers por tipo y campo del contrato.
export type MapaResolvers = Record<
  string,
  Record<string, GraphQLFieldResolver<never, never>>
>;

function errorEntrada(mensaje: string): GraphQLError {
  return new GraphQLError(mensaje, { extensions: { codigo: 'entrada_invalida' } });
}

function validarFechaCivil(valor: unknown): string {
  if (typeof valor !== 'string' || !PATRON_FECHA_CIVIL.test(valor)) {
    throw errorEntrada('FechaCivil espera el formato AAAA-MM-DD');
  }
  return valor;
}

// pg devuelve las columnas `date` como Date; se formatea con los componentes
// locales para no desplazar el día al convertir a UTC.
function serializarFechaCivil(valor: unknown): string {
  if (valor instanceof Date) {
    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
  return validarFechaCivil(valor);
}

function completarEscalarFechaCivil(esquema: GraphQLSchema): void {
  const tipo = esquema.getType('FechaCivil');
  if (!(tipo instanceof GraphQLScalarType)) {
    throw new Error('El contrato no declara el escalar FechaCivil');
  }
  Object.assign(tipo, {
    description: 'AAAA-MM-DD, zona America/Lima',
    serialize: serializarFechaCivil,
    parseValue: validarFechaCivil,
    parseLiteral: (nodo: ValueNode) => {
      if (nodo.kind !== Kind.STRING) {
        throw errorEntrada('FechaCivil espera una cadena AAAA-MM-DD');
      }
      return validarFechaCivil(nodo.value);
    },
  });
}

// Asigna los resolvers sobre los campos del contrato. Si el contrato congelado
// dejara de declarar un tipo o un campo, falla al arrancar en vez de responder
// null en silencio.
export function aplicarResolvers(esquema: GraphQLSchema, mapa: MapaResolvers): void {
  for (const [nombreTipo, campos] of Object.entries(mapa)) {
    const tipo = esquema.getType(nombreTipo);
    if (!isObjectType(tipo)) {
      throw new Error(`El contrato no define el tipo de objeto ${nombreTipo}`);
    }
    const camposDelTipo = tipo.getFields();
    for (const [nombreCampo, resolver] of Object.entries(campos)) {
      const campo = camposDelTipo[nombreCampo];
      if (!campo) {
        throw new Error(`El contrato no define el campo ${nombreTipo}.${nombreCampo}`);
      }
      campo.resolve = resolver as GraphQLFieldResolver<unknown, unknown>;
    }
  }
}

export function construirEsquema(): GraphQLSchema {
  const sdl = readFileSync(RUTA_CONTRATO, 'utf8');
  const esquema = buildSchema(sdl);
  completarEscalarFechaCivil(esquema);
  return esquema;
}
