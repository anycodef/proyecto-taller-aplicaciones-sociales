import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitirToken } from '../../compartido/auth.ts';
import { crearAplicacion } from '../aplicacion.ts';
import { crearDatos } from '../datos.ts';
import { MAXIMO_POR_PAGINA } from '../resolvers.ts';
import { crearEjecutorEspia, levantarServidor, type EjecutorEspia } from './ayuda.ts';
import { CATEQUIZANDOS, DOMINGOS, GRUPOS, REGISTRADO_POR, RIESGOS } from './siembra-prueba.ts';

// Responde el conjunto de la siembra desde memoria, para contar consultas sin
// depender de PostgreSQL. El recorrido contra la base real va en T009-28.
function responder(texto: string, valores: unknown[]): Record<string, unknown>[] {
  const comoFilaCatequizando = (c: (typeof CATEQUIZANDOS)[number]) => ({
    id: c.id,
    grupo_id: c.grupoId,
    identidad_operativa: c.identidadOperativa,
    edad: c.edad,
  });

  if (texto.includes('count(*)')) {
    const grupoId = valores[0];
    return [{ total: CATEQUIZANDOS.filter((c) => c.grupoId === grupoId).length }];
  }

  if (texto.includes('FROM demo_tarea3.grupo')) {
    const ids = valores[0] as string[];
    return GRUPOS.filter((g) => ids.includes(g.id)).map((g) => ({ id: g.id, nombre: g.nombre }));
  }

  if (texto.includes('FROM demo_tarea3.asistencia')) {
    const ids = valores[0] as string[];
    return ids.flatMap((id) =>
      DOMINGOS.map((fecha, indice) => ({
        id: `aaaaaaaa-0000-0000-0000-${String(indice).padStart(12, '0')}`,
        catequizando_id: id,
        fecha,
        estado: 'PRESENTE',
        registrado_por: REGISTRADO_POR,
      }))
    );
  }

  if (texto.includes('FROM demo_tarea3.riesgo')) {
    const ids = valores[0] as string[];
    return RIESGOS.filter((r) => ids.includes(r.catequizandoId)).map((r) => ({
      catequizando_id: r.catequizandoId,
      nivel: r.nivel,
      motivo: r.motivo,
      calculado_en: '2026-11-09T10:00:00.000Z',
    }));
  }

  // Lote de catequizandos por id (el cargador de Query.catequizando).
  if (texto.includes('WHERE id = ANY')) {
    const ids = valores[0] as string[];
    return CATEQUIZANDOS.filter((c) => ids.includes(c.id)).map(comoFilaCatequizando);
  }

  // Pagina de catequizandos del grupo: WHERE grupo_id = $1 AND ($2 IS NULL OR id > $2) LIMIT $3
  const [grupoId, cursor, limite] = valores as [string, string | null, number];
  return CATEQUIZANDOS.filter((c) => c.grupoId === grupoId && (!cursor || c.id > cursor))
    .slice(0, limite)
    .map(comoFilaCatequizando);
}

async function servidorConEspia() {
  const espia = crearEjecutorEspia(responder);
  const servidor = await levantarServidor(crearAplicacion({ datos: crearDatos(espia) }));
  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
  return { espia, servidor, token };
}

function consultasA(espia: EjecutorEspia, tabla: string): number {
  return espia.consultas.filter(({ texto }) => texto.includes(`demo_tarea3.${tabla}`)).length;
}

test('RF-902: la lista de 12 con asistencias, riesgo y grupo cuesta un numero constante de consultas', async (t) => {
  const { espia, servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { estado, cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) {
       catequizandos(grupoId: $grupoId, primero: 12) {
         total
         nodos { id identidadOperativa edad grupo { id nombre } riesgo { nivel } asistencias { fecha estado } }
       }
     }`,
    { grupoId: GRUPOS[0].id },
    token
  );

  assert.strictEqual(estado, 200);
  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const conexion = cuerpo.data!.catequizandos as { nodos: unknown[]; total: number };
  assert.strictEqual(conexion.nodos.length, 6, 'el grupo 1 de la siembra tiene 6 catequizandos');

  // Sin cargador por lote serian 1 pagina + 1 total + 6 grupos + 6 riesgos +
  // 6 asistencias = 20 consultas. Con lotes son 5, y no crecen con la lista.
  assert.strictEqual(consultasA(espia, 'asistencia'), 1, 'las asistencias van en un solo lote');
  assert.strictEqual(consultasA(espia, 'riesgo'), 1, 'los riesgos van en un solo lote');
  assert.strictEqual(consultasA(espia, 'grupo'), 1, 'los grupos van en un solo lote');
  assert.strictEqual(espia.consultas.length, 5);
});

test('RF-902: el coste no crece al pedir mas nodos (constante, no lineal)', async (t) => {
  const pequena = await servidorConEspia();
  t.after(() => pequena.servidor.cerrar());
  const grande = await servidorConEspia();
  t.after(() => grande.servidor.cerrar());

  const consulta = `query($grupoId: ID!, $primero: Int!) {
    catequizandos(grupoId: $grupoId, primero: $primero) {
      nodos { id grupo { nombre } riesgo { nivel } asistencias { estado } }
    }
  }`;

  await pequena.servidor.consultar(consulta, { grupoId: GRUPOS[0].id, primero: 2 }, pequena.token);
  await grande.servidor.consultar(consulta, { grupoId: GRUPOS[0].id, primero: 12 }, grande.token);

  assert.strictEqual(
    grande.espia.consultas.length,
    pequena.espia.consultas.length,
    'pedir 12 nodos debe costar las mismas consultas que pedir 2'
  );
});

test('RNF-903: ninguna pagina devuelve mas de 50 nodos aunque se pidan mas', async (t) => {
  const { espia, servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  await servidor.consultar(
    `query($grupoId: ID!) { catequizandos(grupoId: $grupoId, primero: 999) { nodos { id } } }`,
    { grupoId: GRUPOS[0].id },
    token
  );

  const pagina = espia.consultas.find(({ texto }) => texto.includes('LIMIT'));
  assert.ok(pagina, 'debe haber una consulta de pagina');
  // Se pide un nodo extra para saber si hay pagina siguiente: 50 + 1.
  assert.strictEqual(pagina.valores[2], MAXIMO_POR_PAGINA + 1);
});

test('RNF-903: `primero` invalido se rechaza con entrada_invalida', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) { catequizandos(grupoId: $grupoId, primero: 0) { total } }`,
    { grupoId: GRUPOS[0].id },
    token
  );
  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'entrada_invalida');
});

test('RF-902: el cursor `despues` avanza la pagina y se agota con siguiente null', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const consulta = `query($grupoId: ID!, $despues: String) {
    catequizandos(grupoId: $grupoId, primero: 4, despues: $despues) {
      nodos { id }
      siguiente
      total
    }
  }`;

  const primera = await servidor.consultar(consulta, { grupoId: GRUPOS[0].id }, token);
  const pagina1 = primera.cuerpo.data!.catequizandos as {
    nodos: { id: string }[];
    siguiente: string | null;
    total: number;
  };
  assert.strictEqual(pagina1.nodos.length, 4);
  assert.strictEqual(pagina1.total, 6);
  assert.ok(pagina1.siguiente, 'quedan 2 catequizandos, debe haber cursor');

  const segunda = await servidor.consultar(
    consulta,
    { grupoId: GRUPOS[0].id, despues: pagina1.siguiente },
    token
  );
  const pagina2 = segunda.cuerpo.data!.catequizandos as {
    nodos: { id: string }[];
    siguiente: string | null;
  };
  assert.strictEqual(pagina2.nodos.length, 2);
  assert.strictEqual(pagina2.siguiente, null, 'la ultima pagina no ofrece cursor');

  const idsPagina1 = pagina1.nodos.map((n) => n.id);
  assert.ok(
    pagina2.nodos.every((n) => !idsPagina1.includes(n.id)),
    'las paginas no se solapan'
  );
});

test('RF-902: un cursor que no es de esta conexion se rechaza', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!, $despues: String) {
       catequizandos(grupoId: $grupoId, despues: $despues) { total }
     }`,
    { grupoId: GRUPOS[0].id, despues: Buffer.from('no-soy-un-uuid').toString('base64url') },
    token
  );
  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'entrada_invalida');
});

test('RF-906: CAT solo lista su grupo y FAM no lista grupos', async (t) => {
  const { servidor } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const consulta = `query($grupoId: ID!) { catequizandos(grupoId: $grupoId) { total } }`;

  const tokenCat = await emitirToken({
    rol: 'CAT',
    grupoId: GRUPOS[0].id,
    identidadOperativa: 'Catequista Demo',
    sub: '99999999-9999-9999-9999-999999999901',
  });
  const propio = await servidor.consultar(consulta, { grupoId: GRUPOS[0].id }, tokenCat);
  assert.strictEqual(propio.cuerpo.errors, undefined);

  const ajeno = await servidor.consultar(consulta, { grupoId: GRUPOS[1].id }, tokenCat);
  assert.strictEqual(ajeno.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');

  const tokenFam = await emitirToken({
    rol: 'FAM',
    grupoId: GRUPOS[0].id,
    identidadOperativa: 'Familia Demo',
    sub: CATEQUIZANDOS[0].id,
  });
  const familia = await servidor.consultar(consulta, { grupoId: GRUPOS[0].id }, tokenFam);
  assert.strictEqual(familia.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-906: FAM solo lee a su hijo y CAT no lee catequizandos de otro grupo', async (t) => {
  const { servidor } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const consulta = `query($id: ID!) { catequizando(id: $id) { id identidadOperativa } }`;

  const tokenFam = await emitirToken({
    rol: 'FAM',
    identidadOperativa: 'Familia Demo',
    sub: CATEQUIZANDOS[0].id,
  });
  const hijo = await servidor.consultar(consulta, { id: CATEQUIZANDOS[0].id }, tokenFam);
  assert.strictEqual(hijo.cuerpo.errors, undefined, JSON.stringify(hijo.cuerpo.errors));
  assert.strictEqual(
    (hijo.cuerpo.data!.catequizando as { id: string }).id,
    CATEQUIZANDOS[0].id
  );

  const ajeno = await servidor.consultar(consulta, { id: CATEQUIZANDOS[1].id }, tokenFam);
  assert.strictEqual(ajeno.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');

  const tokenCat = await emitirToken({
    rol: 'CAT',
    grupoId: GRUPOS[0].id,
    identidadOperativa: 'Catequista Demo',
    sub: '99999999-9999-9999-9999-999999999901',
  });
  const deOtroGrupo = await servidor.consultar(consulta, { id: CATEQUIZANDOS[6].id }, tokenCat);
  assert.strictEqual(deOtroGrupo.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-902: un catequizando inexistente devuelve null, no error', async (t) => {
  const { servidor, token } = await servidorConEspia();
  t.after(() => servidor.cerrar());

  const { cuerpo } = await servidor.consultar(
    `query($id: ID!) { catequizando(id: $id) { id } }`,
    { id: '22222222-2222-2222-2222-222222229999' },
    token
  );
  assert.strictEqual(cuerpo.errors, undefined);
  assert.deepStrictEqual(cuerpo.data, { catequizando: null });
});
