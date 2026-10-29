import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { emitirToken } from '../../compartido/auth.ts';
import { crearAplicacion } from '../aplicacion.ts';
import { clienteSinGrpc, datosSinBase, levantarServidor } from './ayuda.ts';

const GRUPO = '11111111-1111-1111-1111-111111111101';
const CONSULTA_YO = '{ yo { identidadOperativa rol grupoId } }';

test('RF-906: yo devuelve rol, identidadOperativa y grupo del token de cada rol', async (t) => {
  const servidor = await levantarServidor(crearAplicacion({ datos: datosSinBase(), cliente: clienteSinGrpc() }));
  t.after(() => servidor.cerrar());

  const tokenCat = await emitirToken({
    rol: 'CAT',
    grupoId: GRUPO,
    identidadOperativa: 'Catequista Demo',
    sub: '99999999-9999-9999-9999-999999999901',
  });
  const respuestaCat = await servidor.consultar(CONSULTA_YO, {}, tokenCat);
  assert.strictEqual(respuestaCat.estado, 200);
  assert.deepStrictEqual(respuestaCat.cuerpo.data, {
    yo: { identidadOperativa: 'Catequista Demo', rol: 'CAT', grupoId: GRUPO },
  });

  // COORD no trae grupo: el contrato declara grupoId opcional.
  const tokenCoord = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
  const respuestaCoord = await servidor.consultar(CONSULTA_YO, {}, tokenCoord);
  assert.deepStrictEqual(respuestaCoord.cuerpo.data, {
    yo: { identidadOperativa: 'Coordinadora Demo', rol: 'COORD', grupoId: null },
  });
});

test('RF-906: sin token, con esquema distinto de Bearer o con firma ajena responde fuera_de_alcance', async (t) => {
  const servidor = await levantarServidor(crearAplicacion({ datos: datosSinBase(), cliente: clienteSinGrpc() }));
  t.after(() => servidor.cerrar());

  const sinToken = await servidor.consultar(CONSULTA_YO);
  assert.strictEqual(sinToken.estado, 200, 'el agente MCP necesita 200 con el codigo del contrato');
  assert.strictEqual(sinToken.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
  assert.strictEqual(sinToken.cuerpo.data, null);

  const otroEsquema = await fetch(servidor.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: 'Basic dXN1YXJpbzpjbGF2ZQ==',
    },
    body: JSON.stringify({ query: CONSULTA_YO }),
  });
  const cuerpoOtroEsquema = (await otroEsquema.json()) as {
    errors?: { extensions?: { codigo?: string } }[];
  };
  assert.strictEqual(cuerpoOtroEsquema.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');

  // Token bien formado pero firmado con otra clave: no debe aceptarse.
  const claveAjena = new TextEncoder().encode('clave-que-no-es-la-de-la-demo-0001');
  const tokenAjeno = await new SignJWT({
    rol: 'COORD',
    identidadOperativa: 'Intruso',
    sub: 'x',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(claveAjena);
  const conTokenAjeno = await servidor.consultar(CONSULTA_YO, {}, tokenAjeno);
  assert.strictEqual(conTokenAjeno.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-906: un token sin rol valido no autentica', async (t) => {
  const servidor = await levantarServidor(crearAplicacion({ datos: datosSinBase(), cliente: clienteSinGrpc() }));
  t.after(() => servidor.cerrar());

  // Firmado con la clave de la demo, pero con un rol que el contrato no declara.
  const tokenSinRol = await emitirToken({
    rol: 'ADMIN' as never,
    identidadOperativa: 'Rol Inventado',
    sub: '99999999-9999-9999-9999-999999999903',
  });
  const respuesta = await servidor.consultar(CONSULTA_YO, {}, tokenSinRol);
  assert.strictEqual(respuesta.cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
});

test('RF-907: el motivo interno del rechazo no viaja al cliente', async (t) => {
  const servidor = await levantarServidor(crearAplicacion({ datos: datosSinBase(), cliente: clienteSinGrpc() }));
  t.after(() => servidor.cerrar());

  const { cuerpo } = await servidor.consultar(CONSULTA_YO);
  const textoCompleto = JSON.stringify(cuerpo);
  assert.doesNotMatch(textoCompleto, /cabecera|no verifica|identidadOperativa validos/);
});
