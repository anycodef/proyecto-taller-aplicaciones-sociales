import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import { ServidorActualizacion } from '../servidor.ts';
import { crearClienteActualizacion, crearMetadata } from '../cliente.ts';
import { emitirToken } from '../../compartido/auth.ts';
import { pool } from '../../compartido/bd.ts';
import { sembrar } from '../../scripts/bd-sembrar.mjs';

const GRUPO_1_ID = '11111111-1111-1111-1111-111111111101';
// Según bd-sembrar.mjs:
// Ana (22222222-2222-2222-2222-222222222101): presentes -> BAJO
// Luis (22222222-2222-2222-2222-222222222102): 2 ausentes consecutivas -> MEDIO
// Carmen (22222222-2222-2222-2222-222222222103): 3 ausentes consecutivas -> ALTO
const CATEQUIZANDO_BAJO = '22222222-2222-2222-2222-222222222101';
const CATEQUIZANDO_MEDIO = '22222222-2222-2222-2222-222222222102';
const CATEQUIZANDO_ALTO = '22222222-2222-2222-2222-222222222103';
const CATEQUIZANDO_G2 = '22222222-2222-2222-2222-222222222201';

test('RF-908: RecalcularRiesgo clasifica ALTO/MEDIO/BAJO con regla pura y persiste en BD', async () => {
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

    // 1. Recalcular catequizando ALTO
    const resAlto = await new Promise<any>((resolve, reject) => {
      cliente.RecalcularRiesgo({ catequizando_id: CATEQUIZANDO_ALTO }, metadata, (err: any, r: any) =>
        err ? reject(err) : resolve(r)
      );
    });
    assert.strictEqual(resAlto.catequizando_id, CATEQUIZANDO_ALTO);
    assert.ok(resAlto.nivel === 'ALTO' || resAlto.nivel === 3);
    assert.match(resAlto.motivo, /faltas consecutivas sin justificar/);
    assert.ok(resAlto.calculado_en);

    // Verificar persistencia en demo_tarea3.riesgo
    const bdAlto = await pool.query('SELECT nivel, motivo FROM demo_tarea3.riesgo WHERE catequizando_id = $1', [
      CATEQUIZANDO_ALTO,
    ]);
    assert.strictEqual(bdAlto.rowCount, 1);
    assert.strictEqual(bdAlto.rows[0].nivel, 'ALTO');

    // 2. Recalcular catequizando MEDIO
    const resMedio = await new Promise<any>((resolve, reject) => {
      cliente.RecalcularRiesgo({ catequizando_id: CATEQUIZANDO_MEDIO }, metadata, (err: any, r: any) =>
        err ? reject(err) : resolve(r)
      );
    });
    assert.ok(resMedio.nivel === 'MEDIO' || resMedio.nivel === 2);

    // 3. Recalcular catequizando BAJO
    const resBajo = await new Promise<any>((resolve, reject) => {
      cliente.RecalcularRiesgo({ catequizando_id: CATEQUIZANDO_BAJO }, metadata, (err: any, r: any) =>
        err ? reject(err) : resolve(r)
      );
    });
    assert.ok(resBajo.nivel === 'BAJO' || resBajo.nivel === 1);
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test('RF-906: CAT no puede recalcular riesgo de catequizando de otro grupo', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCat1 = await emitirToken({
      rol: 'CAT',
      grupoId: GRUPO_1_ID,
      identidadOperativa: 'Catequista G1',
      sub: 'cat-1',
    });
    const metadata = crearMetadata(tokenCat1);

    await new Promise<void>((resolve, reject) => {
      cliente.RecalcularRiesgo({ catequizando_id: CATEQUIZANDO_G2 }, metadata, (err: any) => {
        if (!err) return reject(new Error('Debió fallar con PERMISSION_DENIED'));
        assert.strictEqual(err.code, grpc.status.PERMISSION_DENIED);
        assert.match(err.message, /fuera_de_alcance/);
        resolve();
      });
    });
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test.after(async () => {
  await pool.end().catch(() => {});
});
