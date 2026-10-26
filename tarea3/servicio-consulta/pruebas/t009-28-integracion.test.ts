// Suite de integracion de P2 (spec 009, T009-28, RF-902 a RF-906).
//
// Habla por HTTP con el servicio real, que lee PostgreSQL real y escribe contra
// el servidor gRPC doble. Lo unico simulado es el servicio de P3, como manda
// plan §2. El esquema demo_tarea3 lo crea esta misma suite aplicando
// bd/migracion.sql, para que no haga falta ningun paso manual (RNF-904).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { emitirToken } from '../../compartido/auth.ts';
import { crearAplicacion } from '../aplicacion.ts';
import { crearClienteGrpc, type ClienteActualizacion } from '../cliente-grpc.ts';
import { crearDatos, type EjecutorSql } from '../datos.ts';
import { levantarServidor, type ServidorDePrueba } from './ayuda.ts';
import { levantarDobleGrpc, type DobleGrpc } from './doble-grpc.ts';
import {
  CATEQUIZANDOS,
  DOMINGOS,
  GRUPOS,
  PLAN_ASISTENCIAS,
  REGISTRADO_POR,
  RIESGOS,
  sembrarParaPruebas,
} from './siembra-prueba.ts';

const RUTA_MIGRACION = join(import.meta.dirname, '..', '..', 'bd', 'migracion.sql');

if (!process.env.PGPASSWORD) {
  process.env.PGPASSWORD = 'postgres';
}

const pool = new pg.Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PUERTO_POSTGRES ?? process.env.PGPORT ?? 55432),
  user: process.env.PGUSER ?? 'postgres',
  database: process.env.PGDATABASE ?? 'sigecat',
});

// Cuenta las consultas que llegan de verdad a PostgreSQL, para comprobar que el
// cargador por lote tambien se sostiene contra el motor real.
let consultas = 0;
const ejecutor: EjecutorSql = {
  query: (texto, valores) => {
    consultas += 1;
    return pool.query(texto, valores);
  },
};

let servidor: ServidorDePrueba;
let doble: DobleGrpc;
let cliente: ClienteActualizacion;
let tokenCoord: string;

before(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    throw new Error(
      'PostgreSQL no responde en el puerto ' +
        `${process.env.PUERTO_POSTGRES ?? 55432}. Levantalo con: ` +
        'PUERTO_POSTGRES=55432 docker compose -f api/docker-compose.yml up -d. ' +
        `Detalle: ${(error as Error).message}`
    );
  }

  await pool.query(readFileSync(RUTA_MIGRACION, 'utf8'));
  await sembrarParaPruebas(ejecutor);

  doble = await levantarDobleGrpc();
  cliente = crearClienteGrpc({ direccion: doble.direccion });
  servidor = await levantarServidor(crearAplicacion({ datos: crearDatos(ejecutor), cliente }));
  tokenCoord = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
});

after(async () => {
  cliente?.cerrar();
  await servidor?.cerrar();
  await doble?.cerrar();
  await pool.end();
});

test('RF-902: catequizandos devuelve los datos sembrados con su total', async () => {
  const { estado, cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) {
       catequizandos(grupoId: $grupoId) { total nodos { id identidadOperativa edad } }
     }`,
    { grupoId: GRUPOS[0].id },
    tokenCoord
  );

  assert.strictEqual(estado, 200);
  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const conexion = cuerpo.data!.catequizandos as {
    total: number;
    nodos: { id: string; identidadOperativa: string; edad: number }[];
  };
  assert.strictEqual(conexion.total, 6);
  assert.strictEqual(conexion.nodos.length, 6);

  const ana = conexion.nodos.find((n) => n.id === CATEQUIZANDOS[0].id);
  assert.strictEqual(ana?.identidadOperativa, CATEQUIZANDOS[0].identidadOperativa);
  assert.strictEqual(ana.edad, CATEQUIZANDOS[0].edad);
});

test('RF-902: catequizando trae grupo, riesgo y asistencias anidados como los pide P4', async () => {
  // Esta es, campo por campo, la consulta de servidor-mcp/cliente-graphql.ts.
  const { cuerpo } = await servidor.consultar(
    `query ConsultarCatequizando($catequizandoId: ID!) {
       catequizando(id: $catequizandoId) {
         id identidadOperativa edad grupo { id nombre }
         riesgo { catequizandoId nivel motivo calculadoEn }
         asistencias { id fecha estado registradoPor }
       }
     }`,
    { catequizandoId: CATEQUIZANDOS[2].id },
    tokenCoord
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const catequizando = cuerpo.data!.catequizando as {
    identidadOperativa: string;
    grupo: { id: string; nombre: string };
    riesgo: { nivel: string; motivo: string; calculadoEn: string };
    asistencias: { fecha: string; estado: string; registradoPor: string }[];
  };

  assert.strictEqual(catequizando.identidadOperativa, CATEQUIZANDOS[2].identidadOperativa);
  assert.deepStrictEqual(catequizando.grupo, { id: GRUPOS[0].id, nombre: GRUPOS[0].nombre });
  assert.strictEqual(catequizando.riesgo.nivel, 'ALTO');
  assert.strictEqual(catequizando.riesgo.motivo, RIESGOS[2].motivo);
  assert.ok(Date.parse(catequizando.riesgo.calculadoEn), 'calculadoEn debe ser ISO 8601');

  assert.strictEqual(catequizando.asistencias.length, DOMINGOS.length);
  // El dia civil sale tal cual se sembro, sin desplazarse por zona horaria.
  assert.deepStrictEqual(
    catequizando.asistencias.map((a) => a.fecha),
    [...DOMINGOS]
  );
  assert.deepStrictEqual(
    catequizando.asistencias.map((a) => a.estado),
    PLAN_ASISTENCIAS[CATEQUIZANDOS[2].id]
  );
  // RF-907: el autor es siempre la identidad operativa.
  assert.ok(catequizando.asistencias.every((a) => a.registradoPor === REGISTRADO_POR));
});

test('RF-902: el rango desde/hasta filtra las asistencias en PostgreSQL', async () => {
  const { cuerpo } = await servidor.consultar(
    `query($id: ID!, $desde: FechaCivil, $hasta: FechaCivil) {
       catequizando(id: $id) { asistencias(desde: $desde, hasta: $hasta) { fecha } }
     }`,
    { id: CATEQUIZANDOS[0].id, desde: DOMINGOS[1], hasta: DOMINGOS[3] },
    tokenCoord
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const fechas = (
    cuerpo.data!.catequizando as { asistencias: { fecha: string }[] }
  ).asistencias.map((a) => a.fecha);
  assert.deepStrictEqual(fechas, [DOMINGOS[1], DOMINGOS[2], DOMINGOS[3]]);
});

test('RF-902: el cargador por lote tambien evita el N+1 contra PostgreSQL real', async () => {
  const antes = consultas;
  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) {
       catequizandos(grupoId: $grupoId) {
         total
         nodos { id grupo { nombre } riesgo { nivel } asistencias { estado } }
       }
     }`,
    { grupoId: GRUPOS[0].id },
    tokenCoord
  );
  const gastadas = consultas - antes;

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  // Pagina + total + un lote de grupos + uno de riesgos + uno de asistencias.
  assert.strictEqual(gastadas, 5, `gasto ${gastadas} consultas y debian ser 5`);
});

test('RF-902: asistenciaDelDomingo cuenta lo que hay sembrado ese domingo', async () => {
  const indice = 2;
  const esperado = { presentes: 0, ausentes: 0, justificadas: 0, tardanzas: 0 };
  for (const catequizando of CATEQUIZANDOS) {
    if (catequizando.grupoId !== GRUPOS[0].id) continue;
    const estado = PLAN_ASISTENCIAS[catequizando.id][indice];
    if (estado === 'PRESENTE') esperado.presentes += 1;
    else if (estado === 'AUSENTE') esperado.ausentes += 1;
    else if (estado === 'JUSTIFICADA') esperado.justificadas += 1;
    else if (estado === 'TARDANZA') esperado.tardanzas += 1;
  }

  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!, $fecha: FechaCivil!) {
       asistenciaDelDomingo(grupoId: $grupoId, fecha: $fecha) {
         fecha presentes ausentes justificadas tardanzas
       }
     }`,
    { grupoId: GRUPOS[0].id, fecha: DOMINGOS[indice] },
    tokenCoord
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  assert.deepStrictEqual(cuerpo.data!.asistenciaDelDomingo, {
    fecha: DOMINGOS[indice],
    ...esperado,
  });
});

test('RF-902: riesgoDelGrupo devuelve los niveles sembrados de mayor a menor', async () => {
  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) { riesgoDelGrupo(grupoId: $grupoId) { catequizandoId nivel motivo } }`,
    { grupoId: GRUPOS[0].id },
    tokenCoord
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const riesgos = cuerpo.data!.riesgoDelGrupo as {
    catequizandoId: string;
    nivel: string;
    motivo: string;
  }[];
  assert.deepStrictEqual(
    riesgos.map((r) => r.nivel),
    ['ALTO', 'MEDIO'],
    'por defecto nivelMinimo es MEDIO'
  );
  assert.strictEqual(riesgos[0].catequizandoId, CATEQUIZANDOS[2].id);
});

test('RNF-903: la paginacion recorre el grupo entero sin repetir ni perder nodos', async () => {
  const consulta = `query($grupoId: ID!, $despues: String) {
    catequizandos(grupoId: $grupoId, primero: 2, despues: $despues) {
      nodos { id }
      siguiente
    }
  }`;

  const vistos: string[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 10; pagina++) {
    const { cuerpo } = await servidor.consultar(
      consulta,
      { grupoId: GRUPOS[0].id, despues: cursor },
      tokenCoord
    );
    assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
    const conexion = cuerpo.data!.catequizandos as {
      nodos: { id: string }[];
      siguiente: string | null;
    };
    vistos.push(...conexion.nodos.map((n) => n.id));
    cursor = conexion.siguiente;
    if (!cursor) break;
  }

  assert.strictEqual(vistos.length, 6);
  assert.strictEqual(new Set(vistos).size, 6, 'ningun nodo aparece dos veces');
  assert.deepStrictEqual(
    [...vistos].sort(),
    CATEQUIZANDOS.filter((c) => c.grupoId === GRUPOS[0].id)
      .map((c) => c.id)
      .sort()
  );
});

test('RF-904: la mutacion viaja a gRPC y vuelve por GraphQL', async () => {
  const id = '66666666-6666-6666-6666-666666666601';
  const { cuerpo } = await servidor.consultar(
    `mutation($e: RegistrarAsistenciaEntrada!) {
       registrarAsistencia(entrada: $e) { id repetido }
     }`,
    {
      e: {
        id,
        catequizandoId: CATEQUIZANDOS[0].id,
        fecha: '2026-11-15',
        estado: 'PRESENTE',
      },
    },
    tokenCoord
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  assert.deepStrictEqual(cuerpo.data, { registrarAsistencia: { id, repetido: false } });
  const llamada = doble.ultima();
  assert.strictEqual(llamada?.solicitud.catequizando_id, CATEQUIZANDOS[0].id);
  assert.strictEqual(llamada.autorizacion, `Bearer ${tokenCoord}`);
});

test('RF-906: CAT lee su grupo y no el ajeno, con datos reales', async () => {
  const tokenCat = await emitirToken({
    rol: 'CAT',
    grupoId: GRUPOS[0].id,
    identidadOperativa: 'Catequista Demo',
    sub: '99999999-9999-9999-9999-999999999901',
  });

  const propio = await servidor.consultar(
    `query($grupoId: ID!) { catequizandos(grupoId: $grupoId) { total } }`,
    { grupoId: GRUPOS[0].id },
    tokenCat
  );
  assert.strictEqual((propio.cuerpo.data!.catequizandos as { total: number }).total, 6);

  const ajeno = await servidor.consultar(
    `query($grupoId: ID!) { catequizandos(grupoId: $grupoId) { total } }`,
    { grupoId: GRUPOS[1].id },
    tokenCat
  );
  assert.strictEqual(ajeno.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');

  // Un catequizando del otro grupo tampoco, aunque exista de verdad.
  const ninoAjeno = await servidor.consultar(
    `query($id: ID!) { catequizando(id: $id) { identidadOperativa } }`,
    { id: CATEQUIZANDOS[6].id },
    tokenCat
  );
  assert.strictEqual(ninoAjeno.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-906: FAM lee a su hijo real y a nadie mas', async () => {
  const tokenFam = await emitirToken({
    rol: 'FAM',
    grupoId: GRUPOS[0].id,
    identidadOperativa: 'Familia Demo',
    sub: CATEQUIZANDOS[1].id,
  });

  const hijo = await servidor.consultar(
    `query($id: ID!) { catequizando(id: $id) { identidadOperativa riesgo { nivel } } }`,
    { id: CATEQUIZANDOS[1].id },
    tokenFam
  );
  assert.strictEqual(hijo.cuerpo.errors, undefined, JSON.stringify(hijo.cuerpo.errors));
  const datos = hijo.cuerpo.data!.catequizando as {
    identidadOperativa: string;
    riesgo: { nivel: string };
  };
  assert.strictEqual(datos.identidadOperativa, CATEQUIZANDOS[1].identidadOperativa);
  assert.strictEqual(datos.riesgo.nivel, 'MEDIO');

  const otroNino = await servidor.consultar(
    `query($id: ID!) { catequizando(id: $id) { identidadOperativa } }`,
    { id: CATEQUIZANDOS[0].id },
    tokenFam
  );
  assert.strictEqual(otroNino.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-907: ninguna respuesta con datos reales trae columnas protegidas', async () => {
  const { cuerpo } = await servidor.consultar(
    `query($grupoId: ID!) {
       catequizandos(grupoId: $grupoId) {
         nodos {
           id identidadOperativa edad
           grupo { id nombre }
           riesgo { nivel motivo }
           asistencias { fecha estado registradoPor }
         }
       }
     }`,
    { grupoId: GRUPOS[0].id },
    tokenCoord
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const texto = JSON.stringify(cuerpo.data);
  assert.doesNotMatch(texto, /salud|neurodiverg|documento|\bdni\b/i);
  // Lo que si aparece es siempre identidad operativa.
  assert.match(texto, /Ana García López/);
});
