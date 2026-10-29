import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import { ServidorActualizacion } from '../servidor.ts';
import { crearClienteActualizacion, crearMetadata } from '../cliente.ts';
import { emitirToken } from '../../compartido/auth.ts';
import { pool } from '../../compartido/bd.ts';
import { sembrar } from '../../scripts/bd-sembrar.mjs';

const GRUPO_1_ID = '11111111-1111-1111-1111-111111111101';
const CATEQUIZANDO_G1 = '22222222-2222-2222-2222-222222222101';
const CATEQUIZANDO_G2 = '22222222-2222-2222-2222-222222222201';

test('RF-903 / RF-905: RegistrarJustificacion crea justificación, cambia estado a JUSTIFICADA y es idempotente', async () => {
  await sembrar();
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCoord = await emitirToken({
      rol: 'COORD',
      identidadOperativa: 'Coordinador Demo',
      sub: 'coord-1',
    });
    const metadata = crearMetadata(tokenCoord);

    // 1. Crear una asistencia inicial como AUSENTE
    const idAsistencia = '77777777-7777-7777-7777-777777777001';
    await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: idAsistencia, catequizando_id: CATEQUIZANDO_G1, fecha: '2026-11-22', estado: 2 }, // AUSENTE
        metadata,
        (err: any, res: any) => (err ? reject(err) : resolve(res))
      );
    });

    const enBdAntes = await pool.query('SELECT estado FROM demo_tarea3.asistencia WHERE id = $1', [idAsistencia]);
    assert.strictEqual(enBdAntes.rows[0].estado, 'AUSENTE');

    // 2. Justificar la falta
    const idJustificacion = '66666666-6666-6666-6666-666666666001';
    const res1 = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarJustificacion(
        { id: idJustificacion, asistencia_id: idAsistencia, motivo: 'Viaje familiar autorizado' },
        metadata,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });

    assert.strictEqual(res1.id, idJustificacion);
    assert.strictEqual(res1.repetido, false);

    // Comprobar que en BD el estado cambió a JUSTIFICADA
    const enBdDespues = await pool.query('SELECT estado FROM demo_tarea3.asistencia WHERE id = $1', [idAsistencia]);
    assert.strictEqual(enBdDespues.rows[0].estado, 'JUSTIFICADA');

    // 3. Repetir la justificación con el mismo id -> idempotente (repetido = true)
    const res2 = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarJustificacion(
        { id: idJustificacion, asistencia_id: idAsistencia, motivo: 'Viaje familiar autorizado' },
        metadata,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });

    assert.strictEqual(res2.id, idJustificacion);
    assert.strictEqual(res2.repetido, true);
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test('RF-906: CAT no puede justificar asistencia de otro grupo', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCoord = await emitirToken({ rol: 'COORD', identidadOperativa: 'Coord', sub: 'c-1' });
    const metaCoord = crearMetadata(tokenCoord);

    // Crear asistencia en Grupo 2
    const idAsisG2 = '77777777-7777-7777-7777-777777777002';
    await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: idAsisG2, catequizando_id: CATEQUIZANDO_G2, fecha: '2026-11-22', estado: 2 },
        metaCoord,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });

    // Token de CAT del Grupo 1
    const tokenCat1 = await emitirToken({
      rol: 'CAT',
      grupoId: GRUPO_1_ID,
      identidadOperativa: 'Cat G1',
      sub: 'cat-1',
    });
    const metaCat1 = crearMetadata(tokenCat1);

    await new Promise<void>((resolve, reject) => {
      cliente.RegistrarJustificacion(
        { id: '66666666-6666-6666-6666-666666666002', asistencia_id: idAsisG2, motivo: 'No autorizado' },
        metaCat1,
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

test.after(async () => {
  await pool.end().catch(() => {});
});
