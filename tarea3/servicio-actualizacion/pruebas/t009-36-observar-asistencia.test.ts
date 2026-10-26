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

test('RF-903 / RF-907: ObservarAsistencia server streaming emite eventos con identidad_operativa', async () => {
  await sembrar();
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCoord = await emitirToken({
      rol: 'COORD',
      identidadOperativa: 'Coordinador Streaming',
      sub: 'coord-streaming-1',
    });
    const metadata = crearMetadata(tokenCoord);

    // 1. Iniciar observación sobre GRUPO_1
    const llamada = cliente.ObservarAsistencia({ grupo_id: GRUPO_1_ID }, metadata);
    const eventos: any[] = [];

    const recibirEvento = new Promise<any>((resolve, reject) => {
      llamada.on('data', (evento: any) => {
        eventos.push(evento);
        resolve(evento);
      });
      llamada.on('error', (err: any) => {
        if (err.code !== grpc.status.CANCELLED) reject(err);
      });
    });

    // Dar margen para que el LISTEN en PostgreSQL esté activo
    await new Promise((r) => setTimeout(r, 400));

    // 2. Registrar una nueva asistencia en Grupo 1
    const idAsistencia = '55555555-5555-5555-5555-555555555001';
    await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: idAsistencia, catequizando_id: CATEQUIZANDO_G1, fecha: '2026-12-06', estado: 1 },
        metadata,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });

    // Esperar a recibir el evento por streaming
    const eventoRecibido = await recibirEvento;
    llamada.cancel();

    assert.strictEqual(eventoRecibido.asistencia_id, idAsistencia);
    assert.strictEqual(eventoRecibido.catequizando_id, CATEQUIZANDO_G1);
    // Verificar que lleva identidad_operativa y nunca nombres reales (RF-907, constitución 7)
    assert.strictEqual(eventoRecibido.identidad_operativa, 'Ana García López');
    assert.strictEqual(eventoRecibido.fecha, '2026-12-06');
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test('RF-906: CAT no puede observar asistencia de otro grupo', async () => {
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
      const llamada = cliente.ObservarAsistencia({ grupo_id: GRUPO_2_ID }, metadata);
      llamada.on('data', () => reject(new Error('No debió recibir datos')));
      llamada.on('error', (err: any) => {
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
