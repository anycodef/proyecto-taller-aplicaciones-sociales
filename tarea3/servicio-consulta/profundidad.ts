// Limite de profundidad de las consultas (spec 009, RNF-903).
//
// El contrato tiene un ciclo: Catequizando -> Grupo -> catequizandos ->
// Catequizando. Sin limite, una sola consulta puede pedir ese ciclo decenas de
// veces y multiplicar el trabajo del servicio y de PostgreSQL. Esta regla lo
// corta antes de ejecutar nada, en la fase de validacion.
//
// La introspeccion queda exenta: su forma la fija el propio esquema, no el
// cliente, asi que no es un vector de abuso, y contarla romperia a GraphiQL,
// Postman y cualquier cliente que descubra el contrato antes de consultar.

import { GraphQLError, Kind, type ASTNode, type SelectionSetNode, type ValidationRule } from 'graphql';

export const PROFUNDIDAD_MAXIMA = 6;

type Fragmentos = Map<string, SelectionSetNode>;

function recogerFragmentos(definiciones: readonly ASTNode[]): Fragmentos {
  const fragmentos: Fragmentos = new Map();
  for (const definicion of definiciones) {
    if (definicion.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentos.set(definicion.name.value, definicion.selectionSet);
    }
  }
  return fragmentos;
}

// Devuelve el nivel mas profundo alcanzado dentro de este conjunto de campos.
// Los fragmentos no suman nivel por si mismos: solo lo suman los campos con
// hijos, que es lo que de verdad anida la respuesta.
function medir(
  conjunto: SelectionSetNode,
  nivel: number,
  fragmentos: Fragmentos,
  enCamino: Set<string>
): number {
  let maxima = nivel;

  for (const seleccion of conjunto.selections) {
    if (seleccion.kind === Kind.FIELD) {
      // __schema, __type y __typename: forma fijada por el esquema.
      if (seleccion.name.value.startsWith('__')) continue;
      if (seleccion.selectionSet) {
        maxima = Math.max(maxima, medir(seleccion.selectionSet, nivel + 1, fragmentos, enCamino));
      }
      continue;
    }

    if (seleccion.kind === Kind.INLINE_FRAGMENT) {
      maxima = Math.max(maxima, medir(seleccion.selectionSet, nivel, fragmentos, enCamino));
      continue;
    }

    const nombre = seleccion.name.value;
    // Un fragmento ciclico lo denuncia la regla propia de graphql; aqui solo se
    // evita girar en redondo al medir.
    if (enCamino.has(nombre)) continue;
    const definicion = fragmentos.get(nombre);
    if (!definicion) continue;
    enCamino.add(nombre);
    maxima = Math.max(maxima, medir(definicion, nivel, fragmentos, enCamino));
    enCamino.delete(nombre);
  }

  return maxima;
}

export function medirProfundidad(
  conjunto: SelectionSetNode,
  fragmentos: Fragmentos = new Map()
): number {
  return medir(conjunto, 1, fragmentos, new Set());
}

export function reglaDeProfundidad(maxima: number = PROFUNDIDAD_MAXIMA): ValidationRule {
  return (contexto) => ({
    OperationDefinition(operacion) {
      const fragmentos = recogerFragmentos(contexto.getDocument().definitions);
      const profundidad = medirProfundidad(operacion.selectionSet, fragmentos);
      if (profundidad > maxima) {
        const nombre = operacion.name ? ` «${operacion.name.value}»` : '';
        contexto.reportError(
          new GraphQLError(
            `La consulta${nombre} anida ${profundidad} niveles y el maximo es ${maxima}. ` +
              'Pide menos niveles o divide la consulta en varias.',
            { nodes: [operacion], extensions: { codigo: 'profundidad_excedida' } }
          )
        );
      }
      // No hace falta recorrer el resto de la operacion: ya se midio entera.
      return false;
    },
  });
}
