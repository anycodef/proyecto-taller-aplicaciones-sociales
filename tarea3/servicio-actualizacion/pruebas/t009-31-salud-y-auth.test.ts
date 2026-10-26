import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import { ServidorActualizacion, verificarSalud } from '../servidor.ts';
import { crearClienteActualizacion, crearMetadata } from '../cliente.ts';
import { emitirToken } from '../../compartido/auth.ts';

test('RF-903: el servidor carga sigecat.proto, arranca y responde al servicio de salud', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  try {
    const salud = await verificarSalud(puerto, '127.0.0.1');
    assert.strictEqual(salud.status, 'SERVING');
  } finally {
    await servidor.detener();
  }
});

test('RF-906: llamada sin metadata authorization es rechazada con PERMISSION_DENIED', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);
  try {
    await new Promise<void>((resolve, reject) => {
      cliente.RegistrarAsistencia({ id: 'dummy', catequizando_id: 'dummy', fecha: '2026-11-15', estado: 1 }, (error: any) => {
        if (!error) return reject(new Error('Debió fallar por falta de token'));
        assert.strictEqual(error.code, grpc.status.PERMISSION_DENIED);
        assert.match(error.message, /no_autenticado/);
        resolve();
      });
    });
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test('RF-906: llamada con token de supervisión (SUP) es rechazada para escritura con PERMISSION_DENIED', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);
  try {
    const tokenSup = await emitirToken({
      rol: 'SUP',
      identidadOperativa: 'Supervisor Demo',
      sub: 'uuid-sup-demo',
    });
    const metadata = crearMetadata(tokenSup);

    await new Promise<void>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: 'dummy', catequizando_id: 'dummy', fecha: '2026-11-15', estado: 1 },
        metadata,
        (error: any) => {
          if (!error) return reject(new Error('Debió fallar porque SUP nunca escribe'));
          assert.strictEqual(error.code, grpc.status.PERMISSION_DENIED);
          assert.match(error.message, /fuera_de_alcance/);
          resolve();
        }
      );
    });
  } finally {
    cliente.close();
    await servidor.detener();
  }
});
