import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import { ServidorActualizacion } from '../servidor.ts';
import { crearClienteActualizacion, crearMetadata } from '../cliente.ts';
import { emitirToken } from '../../compartido/auth.ts';
import { pool } from '../../compartido/bd.ts';
import { sembrar } from '../../scripts/bd-sembrar.mjs';

const GRUPO_1_ID = '11111111-1111-1111-1111-111111111101';
const GRUPO_2_ID = '11111111-1111-1111-1111-111111111102';
const CATEQUIZANDO_G1 = '22222222-2222-2222-2222-222222222101';
const CATEQUIZANDO_G2 = '22222222-2222-2222-2222-222222222201';

test('RF-903 / RF-905: RegistrarAsistencia es idempotente por id (repetido = false luego repetido = true)', async () => {
  await sembrar();
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCat1 = await emitirToken({
      rol: 'CAT',
      grupoId: GRUPO_1_ID,
      identidadOperativa: 'Catequista Juan',
      sub: 'cat-juan-1',
    });
    const metadata = crearMetadata(tokenCat1);

    const idAsistencia = '88888888-8888-8888-8888-888888888001';
    const fecha = '2026-11-22';

    // 1. Primer registro: nuevo (repetido = false)
    const primerResultado = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: idAsistencia, catequizando_id: CATEQUIZANDO_G1, fecha, estado: 1 },
        metadata,
        (err: any, res: any) => (err ? reject(err) : resolve(res))
      );
    });

    assert.strictEqual(primerResultado.id, idAsistencia);
    assert.strictEqual(primerResultado.repetido, false);

    // Verificar en BD que se guardó con la identidad operativa del autor (RF-907)
    const enBd = await pool.query('SELECT * FROM demo_tarea3.asistencia WHERE id = $1', [idAsistencia]);
    assert.strictEqual(enBd.rowCount, 1);
    assert.strictEqual(enBd.rows[0].registrado_por, 'Catequista Juan');
    assert.strictEqual(enBd.rows[0].estado, 'PRESENTE');

    // 2. Segundo registro con el MISMO id: idempotente (repetido = true, sin duplicar)
    const segundoResultado = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: idAsistencia, catequizando_id: CATEQUIZANDO_G1, fecha, estado: 1 },
        metadata,
        (err: any, res: any) => (err ? reject(err) : resolve(res))
      );
    });

    assert.strictEqual(segundoResultado.id, idAsistencia);
    assert.strictEqual(segundoResultado.repetido, true);

    // Comprobar que en BD sigue habiendo exactamente un registro
    const enBd2 = await pool.query('SELECT count(*)::int AS total FROM demo_tarea3.asistencia WHERE id = $1', [idAsistencia]);
    assert.strictEqual(enBd2.rows[0].total, 1);
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test('RF-906: CAT no puede registrar asistencia para catequizando de otro grupo', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    // Catequista del Grupo 1 intenta escribir sobre catequizando del Grupo 2
    const tokenCat1 = await emitirToken({
      rol: 'CAT',
      grupoId: GRUPO_1_ID,
      identidadOperativa: 'Catequista Juan',
      sub: 'cat-juan-1',
    });
    const metadata = crearMetadata(tokenCat1);

    await new Promise<void>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        {
          id: '88888888-8888-8888-8888-888888888002',
          catequizando_id: CATEQUIZANDO_G2, // del Grupo 2
          fecha: '2026-11-22',
          estado: 1,
        },
        metadata,
        (err: any) => {
          if (!err) return reject(new Error('Debió fallar con PERMISSION_DENIED'));
          assert.strictEqual(err.code, grpc.status.PERMISSION_DENIED);
          assert.match(err.message, /fuera_de_alcance/);
          resolve();
        }
      );
    });
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test('RF-906: COORD puede registrar asistencia en cualquier grupo', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCoord = await emitirToken({
      rol: 'COORD',
      identidadOperativa: 'Coordinador General',
      sub: 'coord-general-1',
    });
    const metadata = crearMetadata(tokenCoord);

    const id1 = '88888888-8888-8888-8888-888888888003';
    const id2 = '88888888-8888-8888-8888-888888888004';

    // Puede registrar en Grupo 1
    const res1 = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: id1, catequizando_id: CATEQUIZANDO_G1, fecha: '2026-11-22', estado: 1 },
        metadata,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });
    assert.strictEqual(res1.repetido, false);

    // Puede registrar en Grupo 2
    const res2 = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: id2, catequizando_id: CATEQUIZANDO_G2, fecha: '2026-11-22', estado: 2 },
        metadata,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });
    assert.strictEqual(res2.repetido, false);
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test.after(async () => {
  await pool.end().catch(() => {});
});

