import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GraphQLScalarType } from 'graphql';
import { aplicarResolvers, construirEsquema } from '../esquema.ts';
import { levantarServidor } from './ayuda.ts';

test('RF-902: el esquema se construye desde el contrato congelado con todas sus operaciones', () => {
  const esquema = construirEsquema();

  const consulta = esquema.getQueryType();
  assert.ok(consulta, 'el contrato debe declarar Query');
  assert.deepStrictEqual(Object.keys(consulta.getFields()).sort(), [
    'asistenciaDelDomingo',
    'catequizando',
    'catequizandos',
    'riesgoDelGrupo',
    'yo',
  ]);

  const mutacion = esquema.getMutationType();
  assert.ok(mutacion, 'el contrato debe declarar Mutation');
  assert.deepStrictEqual(Object.keys(mutacion.getFields()).sort(), [
    'recalcularRiesgo',
    'registrarAsistencia',
    'registrarJustificacion',
  ]);
});

test('RF-902: el escalar FechaCivil valida AAAA-MM-DD y serializa fechas de pg', () => {
  const esquema = construirEsquema();
  const fechaCivil = esquema.getType('FechaCivil');
  assert.ok(fechaCivil instanceof GraphQLScalarType);

  assert.strictEqual(fechaCivil.parseValue('2026-11-15'), '2026-11-15');
  assert.strictEqual(fechaCivil.serialize(new Date(2026, 10, 15)), '2026-11-15');
  assert.throws(() => fechaCivil.parseValue('15/11/2026'), /AAAA-MM-DD/);
  assert.throws(() => fechaCivil.parseValue(20261115), /AAAA-MM-DD/);
});

test('RF-902: aplicarResolvers falla si el contrato no declara el campo', () => {
  const esquema = construirEsquema();

  assert.throws(
    () => aplicarResolvers(esquema, { Query: { inventado: () => null } }),
    /Query\.inventado/
  );
  assert.throws(
    () => aplicarResolvers(esquema, { TipoInventado: { campo: () => null } }),
    /TipoInventado/
  );
});

test('RF-902: /salud responde 200 y /graphql resuelve la introspeccion', async (t) => {
  const servidor = await levantarServidor({ esquema: construirEsquema() });
  t.after(() => servidor.cerrar());

  const salud = await fetch(servidor.urlSalud);
  assert.strictEqual(salud.status, 200);
  assert.deepStrictEqual(await salud.json(), { estado: 'ok', servicio: 'servicio-consulta' });

  const { estado, cuerpo } = await servidor.consultar('{ __schema { queryType { name } } }');
  assert.strictEqual(estado, 200);
  assert.strictEqual(cuerpo.errors, undefined);
  assert.deepStrictEqual(cuerpo.data, { __schema: { queryType: { name: 'Query' } } });
});

test('RF-902: una ruta desconocida responde 404 sin filtrar detalles internos', async (t) => {
  const servidor = await levantarServidor({ esquema: construirEsquema() });
  t.after(() => servidor.cerrar());

  const respuesta = await fetch(servidor.urlSalud.replace('/salud', '/otra-cosa'));
  assert.strictEqual(respuesta.status, 404);
});
