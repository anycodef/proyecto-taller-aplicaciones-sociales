import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Kind, parse, type OperationDefinitionNode, type SelectionSetNode } from 'graphql';
import { emitirToken } from '../../compartido/auth.ts';
import { crearAplicacion } from '../aplicacion.ts';
import { medirProfundidad, PROFUNDIDAD_MAXIMA } from '../profundidad.ts';
import { datosSinBase, levantarServidor } from './ayuda.ts';

const CATEQUIZANDO = '22222222-2222-2222-2222-222222222101';

// El ciclo del contrato: Catequizando -> Grupo -> catequizandos -> Catequizando.
const PROFUNDIDAD_6 = `query Seis($id: ID!) {
  catequizando(id: $id) {
    grupo {
      catequizandos {
        nodos {
          grupo { nombre }
        }
      }
    }
  }
}`;

const PROFUNDIDAD_7 = `query Siete($id: ID!) {
  catequizando(id: $id) {
    grupo {
      catequizandos {
        nodos {
          grupo {
            catequizandos { total }
          }
        }
      }
    }
  }
}`;

function conjuntoDe(consulta: string): SelectionSetNode {
  const documento = parse(consulta);
  const operacion = documento.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION
  );
  assert.ok(operacion);
  return operacion.selectionSet;
}

function fragmentosDe(consulta: string): Map<string, SelectionSetNode> {
  const mapa = new Map<string, SelectionSetNode>();
  for (const definicion of parse(consulta).definitions) {
    if (definicion.kind === Kind.FRAGMENT_DEFINITION) {
      mapa.set(definicion.name.value, definicion.selectionSet);
    }
  }
  return mapa;
}

async function servidor() {
  return levantarServidor(crearAplicacion({ datos: datosSinBase() }));
}

function tokenCoord() {
  return emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
}

test('RNF-903: medirProfundidad cuenta los niveles que de verdad anidan la respuesta', () => {
  assert.strictEqual(medirProfundidad(conjuntoDe('{ yo { rol } }')), 2);
  assert.strictEqual(medirProfundidad(conjuntoDe(PROFUNDIDAD_6)), 6);
  assert.strictEqual(medirProfundidad(conjuntoDe(PROFUNDIDAD_7)), 7);
  assert.strictEqual(PROFUNDIDAD_MAXIMA, 6);
});

test('RNF-903: los fragmentos cuentan para la profundidad y no suman nivel por si mismos', () => {
  const conFragmento = `query($id: ID!) {
    catequizando(id: $id) { grupo { ...ElGrupo } }
  }
  fragment ElGrupo on Grupo { catequizandos { nodos { grupo { nombre } } } }`;
  // Mismo anidamiento que PROFUNDIDAD_6, escrito con fragmento.
  assert.strictEqual(
    medirProfundidad(conjuntoDe(conFragmento), fragmentosDe(conFragmento)),
    6
  );

  const enLinea = `query($id: ID!) {
    catequizando(id: $id) { ... on Catequizando { grupo { nombre } } }
  }`;
  assert.strictEqual(medirProfundidad(conjuntoDe(enLinea)), 3);
});

test('RNF-903: un fragmento ciclico no cuelga la medicion', () => {
  const ciclico = `query($id: ID!) { catequizando(id: $id) { ...A } }
  fragment A on Catequizando { grupo { ...B } }
  fragment B on Grupo { catequizandos { nodos { ...A } } }`;
  // El ciclo lo denuncia la regla propia de graphql; medir solo debe terminar.
  const profundidad = medirProfundidad(conjuntoDe(ciclico), fragmentosDe(ciclico));
  assert.ok(Number.isFinite(profundidad));
});

test('RNF-903: una consulta de 7 niveles se rechaza con un mensaje que dice el limite', async (t) => {
  const s = await servidor();
  t.after(() => s.cerrar());

  const { cuerpo } = await s.consultar(PROFUNDIDAD_7, { id: CATEQUIZANDO }, await tokenCoord());

  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'profundidad_excedida');
  assert.strictEqual(cuerpo.data, undefined, 'una consulta invalida no se ejecuta');
  const mensaje = cuerpo.errors![0].message;
  assert.match(mensaje, /anida 7 niveles/);
  assert.match(mensaje, /maximo es 6/);
  assert.match(mensaje, /Siete/, 'el mensaje nombra la operacion');
});

// Con application/json la especificacion GraphQL-over-HTTP manda responder 200
// y poner el fallo en `errors`; el 400 es solo para el tipo nuevo. P4 y P5 no
// envian `accept`, asi que reciben 200: el codigo del error es lo que importa.
test('RNF-903: el rechazo llega con 200 y codigo, o con 400 si el cliente pide el tipo nuevo', async (t) => {
  const s = await servidor();
  t.after(() => s.cerrar());

  const conJson = await s.consultar(PROFUNDIDAD_7, { id: CATEQUIZANDO });
  assert.strictEqual(conJson.estado, 200);
  assert.strictEqual(conJson.cuerpo.errors?.[0]?.extensions?.codigo, 'profundidad_excedida');

  const conTipoNuevo = await fetch(s.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/graphql-response+json',
    },
    body: JSON.stringify({ query: PROFUNDIDAD_7, variables: { id: CATEQUIZANDO } }),
  });
  assert.strictEqual(conTipoNuevo.status, 400);
  const cuerpoNuevo = (await conTipoNuevo.json()) as {
    errors?: { extensions?: { codigo?: string } }[];
  };
  assert.strictEqual(cuerpoNuevo.errors?.[0]?.extensions?.codigo, 'profundidad_excedida');
});

test('RNF-903: una consulta de 6 niveles pasa la validacion', async (t) => {
  const s = await servidor();
  t.after(() => s.cerrar());

  const { cuerpo } = await s.consultar(PROFUNDIDAD_6, { id: CATEQUIZANDO }, await tokenCoord());

  // Sin base de datos la ejecucion falla, pero no por profundidad: lo que se
  // comprueba es que la regla no la corta.
  const codigos = (cuerpo.errors ?? []).map((e) => e.extensions?.codigo);
  assert.ok(!codigos.includes('profundidad_excedida'), JSON.stringify(cuerpo.errors));
});

test('RNF-903: la introspeccion queda exenta del limite', async (t) => {
  const s = await servidor();
  t.after(() => s.cerrar());

  // Mas de 6 niveles de introspeccion: su forma la fija el esquema, no el cliente.
  const { estado, cuerpo } = await s.consultar(`{
    __schema {
      queryType {
        fields {
          type { ofType { ofType { ofType { name } } } }
        }
      }
    }
  }`);

  assert.strictEqual(estado, 200);
  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
});

test('RNF-903: la regla se suma a las de graphql, no las reemplaza', async (t) => {
  const s = await servidor();
  t.after(() => s.cerrar());

  const { cuerpo } = await s.consultar('{ campoQueNoExiste }', {}, await tokenCoord());

  assert.ok(cuerpo.errors?.length, 'las reglas estandar deben seguir validando');
  assert.match(JSON.stringify(cuerpo.errors), /campoQueNoExiste/);
  assert.strictEqual(cuerpo.data, undefined);
});
