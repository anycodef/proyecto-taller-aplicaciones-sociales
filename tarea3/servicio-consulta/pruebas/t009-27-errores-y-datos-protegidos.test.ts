import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import {
  getIntrospectionQuery,
  graphqlSync,
  isEnumType,
  isInputObjectType,
  isObjectType,
} from 'graphql';
import { emitirToken } from '../../compartido/auth.ts';
import { crearAplicacion } from '../aplicacion.ts';
import { crearClienteGrpc } from '../cliente-grpc.ts';
import { construirEsquema } from '../esquema.ts';
import { traducirEstadoGrpc } from '../errores.ts';
import { clienteSinGrpc, crearEjecutorEspia, datosSinBase, levantarServidor } from './ayuda.ts';
import { errorGrpc, levantarDobleGrpc, type RespuestasDoble } from './doble-grpc.ts';
import { CATEQUIZANDOS, DOMINGOS, REGISTRADO_POR } from './siembra-prueba.ts';
import { crearDatos } from '../datos.ts';

// Palabras que no deben aparecer en ninguna parte del contrato ni de ninguna
// respuesta (constitucion 7, RF-907).
const PROHIBIDAS =
  /salud|neurodiverg|discapacid|diagnostic|diagnóstic|alergi|medicament|documento|\bdni\b|pasaporte|partida/i;

const MUTACION_ASISTENCIA = `mutation($e: RegistrarAsistenciaEntrada!) {
  registrarAsistencia(entrada: $e) { id repetido }
}`;

const ENTRADA = {
  id: '33333333-3333-3333-3333-333333333301',
  catequizandoId: CATEQUIZANDOS[0].id,
  fecha: '2026-11-15',
  estado: 'PRESENTE',
};

async function montar(respuestas: RespuestasDoble) {
  const doble = await levantarDobleGrpc(respuestas);
  const cliente = crearClienteGrpc({ direccion: doble.direccion });
  const servidor = await levantarServidor(crearAplicacion({ datos: datosSinBase(), cliente }));
  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
  return {
    servidor,
    token,
    async cerrar() {
      cliente.cerrar();
      await servidor.cerrar();
      await doble.cerrar();
    },
  };
}

test('RF-906: cada estado de gRPC se traduce al codigo que el contrato define', () => {
  assert.strictEqual(traducirEstadoGrpc(grpc.status.PERMISSION_DENIED).codigo, 'fuera_de_alcance');
  assert.strictEqual(traducirEstadoGrpc(grpc.status.UNAUTHENTICATED).codigo, 'fuera_de_alcance');
  assert.strictEqual(traducirEstadoGrpc(grpc.status.NOT_FOUND).codigo, 'no_encontrado');
  assert.strictEqual(traducirEstadoGrpc(grpc.status.INVALID_ARGUMENT).codigo, 'entrada_invalida');
  assert.strictEqual(
    traducirEstadoGrpc(grpc.status.UNAVAILABLE).codigo,
    'servicio_no_disponible'
  );
  // Cualquier estado no previsto cae en error_interno, nunca en fuera_de_alcance.
  assert.strictEqual(traducirEstadoGrpc(grpc.status.INTERNAL).codigo, 'error_interno');
  assert.strictEqual(traducirEstadoGrpc(grpc.status.DATA_LOSS).codigo, 'error_interno');
  assert.strictEqual(traducirEstadoGrpc(undefined).codigo, 'error_interno');
});

test('RF-906: PERMISSION_DENIED de P3 llega como fuera_de_alcance', async (t) => {
  const m = await montar({
    RegistrarAsistencia: () => {
      throw errorGrpc(
        grpc.status.PERMISSION_DENIED,
        'fuera_de_alcance: el rol SUP no puede escribir'
      );
    },
  });
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(MUTACION_ASISTENCIA, { e: ENTRADA }, m.token);
  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-907: un fallo inesperado de P3 no deja salir su mensaje interno', async (t) => {
  const m = await montar({
    RegistrarAsistencia: () => {
      // Un error de PostgreSQL con nombres de columna y un valor de la fila.
      throw errorGrpc(
        grpc.status.INTERNAL,
        'error: null value in column "identidad_operativa" of relation "catequizando" viola not-null, fila Ana García López'
      );
    },
  });
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(MUTACION_ASISTENCIA, { e: ENTRADA }, m.token);

  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'error_interno');
  const textoCompleto = JSON.stringify(cuerpo);
  assert.doesNotMatch(textoCompleto, /identidad_operativa/);
  assert.doesNotMatch(textoCompleto, /relation/);
  assert.doesNotMatch(textoCompleto, /Ana García López/);
});

test('RF-906: si el servicio de actualizacion esta caido, el codigo lo dice', async (t) => {
  // Puerto cerrado a proposito: ningun servidor escucha ahi.
  const cliente = crearClienteGrpc({ direccion: '127.0.0.1:1' });
  const servidor = await levantarServidor(crearAplicacion({ datos: datosSinBase(), cliente }));
  t.after(async () => {
    cliente.cerrar();
    await servidor.cerrar();
  });

  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
  const { cuerpo } = await servidor.consultar(MUTACION_ASISTENCIA, { e: ENTRADA }, token);

  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'servicio_no_disponible');
  assert.doesNotMatch(JSON.stringify(cuerpo), /127\.0\.0\.1/, 'ni la direccion interna se filtra');
});

test('RF-907: el contrato introspectado no declara salud, neurodivergencia ni documentos', () => {
  const esquema = construirEsquema();

  for (const tipo of Object.values(esquema.getTypeMap())) {
    if (tipo.name.startsWith('__')) continue;
    assert.doesNotMatch(tipo.name, PROHIBIDAS, `el tipo ${tipo.name} nombra un dato protegido`);

    if (isObjectType(tipo) || isInputObjectType(tipo)) {
      for (const campo of Object.values(tipo.getFields())) {
        assert.doesNotMatch(
          campo.name,
          PROHIBIDAS,
          `el campo ${tipo.name}.${campo.name} nombra un dato protegido`
        );
      }
    }

    if (isEnumType(tipo)) {
      for (const valor of tipo.getValues()) {
        assert.doesNotMatch(valor.name, PROHIBIDAS);
      }
    }
  }
});

// Recoge todos los `name` del arbol de introspeccion: tipos, campos,
// argumentos y valores de enum. Se miran los nombres y no las descripciones,
// porque el propio contrato lleva escrito «Nunca incluye salud,
// neurodivergencia ni documentos (RF-907)», que es justo lo contrario de una
// fuga.
function nombresDe(valor: unknown, encontrados: string[] = []): string[] {
  if (Array.isArray(valor)) {
    for (const elemento of valor) nombresDe(elemento, encontrados);
    return encontrados;
  }
  if (valor && typeof valor === 'object') {
    for (const [clave, anidado] of Object.entries(valor)) {
      if (clave === 'name' && typeof anidado === 'string') encontrados.push(anidado);
      else nombresDe(anidado, encontrados);
    }
  }
  return encontrados;
}

test('RF-907: ningun nombre de la introspeccion completa alude a un dato protegido', () => {
  const esquema = construirEsquema();
  const resultado = graphqlSync({ schema: esquema, source: getIntrospectionQuery() });

  assert.strictEqual(resultado.errors, undefined);
  const nombres = nombresDe(resultado.data);
  assert.ok(nombres.length > 50, 'la introspeccion debe traer el contrato entero');
  for (const nombre of nombres) {
    assert.doesNotMatch(nombre, PROHIBIDAS, `la introspeccion expone «${nombre}»`);
  }
});

test('RF-907: registradoPor devuelve la identidad operativa, no un nombre real', async (t) => {
  const espia = crearEjecutorEspia((texto, valores) => {
    if (texto.includes('WHERE id = ANY')) {
      const ids = valores[0] as string[];
      return CATEQUIZANDOS.filter((c) => ids.includes(c.id)).map((c) => ({
        id: c.id,
        grupo_id: c.grupoId,
        identidad_operativa: c.identidadOperativa,
        edad: c.edad,
      }));
    }
    if (texto.includes('FROM demo_tarea3.asistencia')) {
      const ids = valores[0] as string[];
      return ids.map((id) => ({
        id: '55555555-5555-5555-5555-555555555501',
        catequizando_id: id,
        fecha: DOMINGOS[0],
        estado: 'PRESENTE',
        // La columna registrado_por guarda siempre identidadOperativa.
        registrado_por: REGISTRADO_POR,
      }));
    }
    throw new Error(`consulta no prevista: ${texto}`);
  });

  const servidor = await levantarServidor(
    crearAplicacion({ datos: crearDatos(espia), cliente: clienteSinGrpc() })
  );
  t.after(() => servidor.cerrar());

  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
  const { cuerpo } = await servidor.consultar(
    `query($id: ID!) { catequizando(id: $id) { asistencias { registradoPor } } }`,
    { id: CATEQUIZANDOS[0].id },
    token
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const asistencias = (cuerpo.data!.catequizando as { asistencias: { registradoPor: string }[] })
    .asistencias;
  assert.strictEqual(asistencias[0].registradoPor, REGISTRADO_POR);
  assert.match(asistencias[0].registradoPor, /Identidad Operativa/);
});
