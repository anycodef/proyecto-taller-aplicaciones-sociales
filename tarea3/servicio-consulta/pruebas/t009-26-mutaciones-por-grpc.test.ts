import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitirToken } from '../../compartido/auth.ts';
import { crearAplicacion } from '../aplicacion.ts';
import { crearClienteGrpc } from '../cliente-grpc.ts';
import { datosSinBase, levantarServidor } from './ayuda.ts';
import { levantarDobleGrpc, type RespuestasDoble } from './doble-grpc.ts';
import { CATEQUIZANDOS } from './siembra-prueba.ts';

const ID_ASISTENCIA = '33333333-3333-3333-3333-333333333301';
const ID_JUSTIFICACION = '44444444-4444-4444-4444-444444444401';
const FECHA = '2026-11-15';

const MUTACION_ASISTENCIA = `mutation($e: RegistrarAsistenciaEntrada!) {
  registrarAsistencia(entrada: $e) { id repetido }
}`;

const MUTACION_JUSTIFICACION = `mutation($e: RegistrarJustificacionEntrada!) {
  registrarJustificacion(entrada: $e) { id repetido }
}`;

const MUTACION_RIESGO = `mutation($catequizandoId: ID!) {
  recalcularRiesgo(catequizandoId: $catequizandoId) {
    catequizandoId nivel motivo calculadoEn
  }
}`;

async function montar(respuestas: RespuestasDoble = {}) {
  const doble = await levantarDobleGrpc(respuestas);
  const cliente = crearClienteGrpc({ direccion: doble.direccion });
  const servidor = await levantarServidor(
    crearAplicacion({ datos: datosSinBase(), cliente })
  );
  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinadora Demo',
    sub: '99999999-9999-9999-9999-999999999902',
  });
  return {
    doble,
    servidor,
    token,
    async cerrar() {
      cliente.cerrar();
      await servidor.cerrar();
      await doble.cerrar();
    },
  };
}

test('RF-904: registrarAsistencia llega al servicio gRPC con los nombres del proto', async (t) => {
  const m = await montar();
  t.after(() => m.cerrar());

  const { estado, cuerpo } = await m.servidor.consultar(
    MUTACION_ASISTENCIA,
    {
      e: {
        id: ID_ASISTENCIA,
        catequizandoId: CATEQUIZANDOS[0].id,
        fecha: FECHA,
        estado: 'PRESENTE',
      },
    },
    m.token
  );

  assert.strictEqual(estado, 200);
  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  assert.deepStrictEqual(cuerpo.data, {
    registrarAsistencia: { id: ID_ASISTENCIA, repetido: false },
  });

  const llamada = m.doble.ultima();
  assert.strictEqual(llamada?.metodo, 'RegistrarAsistencia');
  // camelCase del contrato GraphQL -> snake_case del proto, y el enum por nombre.
  assert.strictEqual(llamada.solicitud.id, ID_ASISTENCIA);
  assert.strictEqual(llamada.solicitud.catequizando_id, CATEQUIZANDOS[0].id);
  assert.strictEqual(llamada.solicitud.fecha, FECHA);
  assert.strictEqual(llamada.solicitud.estado, 'PRESENTE');
});

test('RF-904: el Bearer viaja intacto en la metadata authorization', async (t) => {
  const m = await montar();
  t.after(() => m.cerrar());

  await m.servidor.consultar(
    MUTACION_ASISTENCIA,
    {
      e: {
        id: ID_ASISTENCIA,
        catequizandoId: CATEQUIZANDOS[0].id,
        fecha: FECHA,
        estado: 'AUSENTE',
      },
    },
    m.token
  );

  // P3 acepta «Bearer <jwt>» o el jwt crudo; se reenvia tal cual llego.
  assert.strictEqual(m.doble.ultima()?.autorizacion, `Bearer ${m.token}`);
});

test('RF-905: la puerta GraphQL devuelve el repetido que decide P3, sin inventarlo', async (t) => {
  let llamadas = 0;
  const m = await montar({
    RegistrarAsistencia: (solicitud) => {
      llamadas += 1;
      // Segunda vez con el mismo id: idempotencia resuelta en el servicio de P3.
      return { id: solicitud.id, repetido: llamadas > 1 };
    },
  });
  t.after(() => m.cerrar());

  const variables = {
    e: {
      id: ID_ASISTENCIA,
      catequizandoId: CATEQUIZANDOS[0].id,
      fecha: FECHA,
      estado: 'PRESENTE',
    },
  };

  const primera = await m.servidor.consultar(MUTACION_ASISTENCIA, variables, m.token);
  assert.strictEqual(
    (primera.cuerpo.data!.registrarAsistencia as { repetido: boolean }).repetido,
    false
  );

  const segunda = await m.servidor.consultar(MUTACION_ASISTENCIA, variables, m.token);
  assert.strictEqual(
    (segunda.cuerpo.data!.registrarAsistencia as { repetido: boolean }).repetido,
    true
  );
  assert.strictEqual(m.doble.llamadas.length, 2, 'cada mutacion es una llamada gRPC');
});

test('RF-904: registrarJustificacion traduce asistenciaId a asistencia_id', async (t) => {
  const m = await montar();
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(
    MUTACION_JUSTIFICACION,
    { e: { id: ID_JUSTIFICACION, asistenciaId: ID_ASISTENCIA, motivo: 'Cita medica familiar' } },
    m.token
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  const llamada = m.doble.ultima();
  assert.strictEqual(llamada?.metodo, 'RegistrarJustificacion');
  assert.strictEqual(llamada.solicitud.asistencia_id, ID_ASISTENCIA);
  assert.strictEqual(llamada.solicitud.motivo, 'Cita medica familiar');
});

test('RF-904: recalcularRiesgo traduce la respuesta del proto al contrato GraphQL', async (t) => {
  const m = await montar({
    RecalcularRiesgo: (solicitud) => ({
      catequizando_id: solicitud.catequizando_id,
      nivel: 'ALTO',
      motivo: '3 faltas consecutivas sin justificar',
      calculado_en: '2026-11-09T10:00:00.000Z',
    }),
  });
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(
    MUTACION_RIESGO,
    { catequizandoId: CATEQUIZANDOS[2].id },
    m.token
  );

  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
  assert.deepStrictEqual(cuerpo.data, {
    recalcularRiesgo: {
      catequizandoId: CATEQUIZANDOS[2].id,
      nivel: 'ALTO',
      motivo: '3 faltas consecutivas sin justificar',
      calculadoEn: '2026-11-09T10:00:00.000Z',
    },
  });
  assert.strictEqual(m.doble.ultima()?.solicitud.catequizando_id, CATEQUIZANDOS[2].id);
});

test('RF-904: un nivel que el contrato no declara no se devuelve como si lo fuera', async (t) => {
  const m = await montar({
    RecalcularRiesgo: (solicitud) => ({
      catequizando_id: solicitud.catequizando_id,
      // Valor cero del enum del proto: el contrato GraphQL no lo declara.
      nivel: 'NIVEL_RIESGO_NO_ESPECIFICADO',
      motivo: '',
      calculado_en: '2026-11-09T10:00:00.000Z',
    }),
  });
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(
    MUTACION_RIESGO,
    { catequizandoId: CATEQUIZANDOS[0].id },
    m.token
  );
  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'entrada_invalida');
  assert.match(cuerpo.errors![0].message, /NIVEL_RIESGO_NO_ESPECIFICADO/);
});

test('RF-906: sin token no se llega a llamar al servicio de actualizacion', async (t) => {
  const m = await montar();
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(MUTACION_ASISTENCIA, {
    e: {
      id: ID_ASISTENCIA,
      catequizandoId: CATEQUIZANDOS[0].id,
      fecha: FECHA,
      estado: 'PRESENTE',
    },
  });

  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'fuera_de_alcance');
  assert.strictEqual(m.doble.llamadas.length, 0, 'no se gasta una llamada gRPC sin token');
});

test('RF-904: un id que no es UUID se rechaza antes de llamar a gRPC', async (t) => {
  const m = await montar();
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(
    MUTACION_ASISTENCIA,
    {
      e: {
        id: 'no-soy-un-uuid',
        catequizandoId: CATEQUIZANDOS[0].id,
        fecha: FECHA,
        estado: 'PRESENTE',
      },
    },
    m.token
  );

  assert.strictEqual(cuerpo.errors?.[0]?.extensions?.codigo, 'entrada_invalida');
  assert.strictEqual(m.doble.llamadas.length, 0);
});

test('RF-902: la puerta de mutaciones no consulta PostgreSQL por su cuenta', async (t) => {
  // datosSinBase lanza si alguien consulta: la mutacion no debe tocar la base,
  // solo delegar (RF-904, sin duplicar reglas de negocio).
  const m = await montar();
  t.after(() => m.cerrar());

  const { cuerpo } = await m.servidor.consultar(
    MUTACION_ASISTENCIA,
    {
      e: {
        id: ID_ASISTENCIA,
        catequizandoId: CATEQUIZANDOS[0].id,
        fecha: FECHA,
        estado: 'TARDANZA',
      },
    },
    m.token
  );
  assert.strictEqual(cuerpo.errors, undefined, JSON.stringify(cuerpo.errors));
});
