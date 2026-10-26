import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import { ServidorActualizacion, verificarSalud } from '../servidor.ts';
import { crearClienteActualizacion, crearMetadata, esperarConexion } from '../cliente.ts';
import { emitirToken } from '../../compartido/auth.ts';
import { pool } from '../../compartido/bd.ts';
import { sembrar } from '../../scripts/bd-sembrar.mjs';

const GRUPO_1_ID = '11111111-1111-1111-1111-111111111101';
const CATEQUIZANDO_G1 = '22222222-2222-2222-2222-222222222101';
const CATEQUIZANDO_G2 = '22222222-2222-2222-2222-222222222201';

test('RF-903 / RF-905 / RF-908: recorrido completo con cliente gRPC real contra BD de pruebas', async () => {
  await sembrar();
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    // 1. Verificar salud gRPC
    await esperarConexion(cliente, 3000);
    const salud = await verificarSalud(puerto, '127.0.0.1');
    assert.strictEqual(salud.status, 'SERVING');

    const tokenCoord = await emitirToken({
      rol: 'COORD',
      identidadOperativa: 'Coordinadora Parroquial',
      sub: 'coord-parroquia-1',
    });
    const metaCoord = crearMetadata(tokenCoord);

    // 2. RegistrarAsistencia (idempotente - RF-905)
    const idAsistencia = '12345678-1234-1234-1234-123456789001';
    const fecha = '2026-12-13';

    // Primer registro
    const reg1 = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: idAsistencia, catequizando_id: CATEQUIZANDO_G1, fecha, estado: 2 }, // AUSENTE
        metaCoord,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });
    assert.strictEqual(reg1.id, idAsistencia);
    assert.strictEqual(reg1.repetido, false);

    // Segundo registro con mismo id (idempotencia)
    const reg2 = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: idAsistencia, catequizando_id: CATEQUIZANDO_G1, fecha, estado: 2 },
        metaCoord,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });
    assert.strictEqual(reg2.id, idAsistencia);
    assert.strictEqual(reg2.repetido, true);

    // 3. RegistrarJustificacion (cambia estado a JUSTIFICADA)
    const idJust = '12345678-1234-1234-1234-123456789002';
    const justRes = await new Promise<any>((resolve, reject) => {
      cliente.RegistrarJustificacion(
        { id: idJust, asistencia_id: idAsistencia, motivo: 'Certificado médico presentado' },
        metaCoord,
        (err: any, r: any) => (err ? reject(err) : resolve(r))
      );
    });
    assert.strictEqual(justRes.id, idJust);
    assert.strictEqual(justRes.repetido, false);

    const asisEnBd = await pool.query('SELECT estado FROM demo_tarea3.asistencia WHERE id = $1', [idAsistencia]);
    assert.strictEqual(asisEnBd.rows[0].estado, 'JUSTIFICADA');

    // 4. RecalcularRiesgo (RF-908)
    const riesgoRes = await new Promise<any>((resolve, reject) => {
      cliente.RecalcularRiesgo({ catequizando_id: CATEQUIZANDO_G1 }, metaCoord, (err: any, r: any) =>
        err ? reject(err) : resolve(r)
      );
    });
    assert.strictEqual(riesgoRes.catequizando_id, CATEQUIZANDO_G1);
    assert.ok(riesgoRes.nivel);
    assert.ok(riesgoRes.motivo);

    // 5. RegistrarAsistenciaLote (client streaming)
    const loteRes = await new Promise<any>((resolve, reject) => {
      const llamada = cliente.RegistrarAsistenciaLote(metaCoord, (err: any, r: any) =>
        err ? reject(err) : resolve(r)
      );
      llamada.write({ id: '12345678-1234-1234-1234-123456789003', catequizando_id: CATEQUIZANDO_G1, fecha: '2026-12-20', estado: 1 });
      llamada.write({ id: '12345678-1234-1234-1234-123456789003', catequizando_id: CATEQUIZANDO_G1, fecha: '2026-12-20', estado: 1 }); // repetido
      llamada.end();
    });
    assert.strictEqual(loteRes.registrados, 1);
    assert.strictEqual(loteRes.repetidos, 1);
    assert.strictEqual(loteRes.rechazados, 0);
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test('RF-906: prueba explícita de un CAT escribiendo en otro grupo (rechazo con PERMISSION_DENIED)', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCat1 = await emitirToken({
      rol: 'CAT',
      grupoId: GRUPO_1_ID,
      identidadOperativa: 'Catequista Grupo 1',
      sub: 'cat-g1-test',
    });
    const metaCat1 = crearMetadata(tokenCat1);

    // Intenta registrar asistencia para un niño del Grupo 2
    await new Promise<void>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: '12345678-1234-1234-1234-123456789010', catequizando_id: CATEQUIZANDO_G2, fecha: '2026-12-13', estado: 1 },
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

test('RF-906: prueba explícita de SUP intentando escribir (rechazo con PERMISSION_DENIED)', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenSup = await emitirToken({
      rol: 'SUP',
      identidadOperativa: 'Supervisor Diocesano',
      sub: 'sup-diocesano-1',
    });
    const metaSup = crearMetadata(tokenSup);

    // 1. SUP intenta RegistrarAsistencia -> PERMISSION_DENIED
    await new Promise<void>((resolve, reject) => {
      cliente.RegistrarAsistencia(
        { id: '12345678-1234-1234-1234-123456789020', catequizando_id: CATEQUIZANDO_G1, fecha: '2026-12-13', estado: 1 },
        metaSup,
        (err: any) => {
          if (!err) return reject(new Error('SUP no puede RegistrarAsistencia'));
          assert.strictEqual(err.code, grpc.status.PERMISSION_DENIED);
          assert.match(err.message, /fuera_de_alcance/);
          resolve();
        }
      );
    });

    // 2. SUP intenta RegistrarJustificacion -> PERMISSION_DENIED
    await new Promise<void>((resolve, reject) => {
      cliente.RegistrarJustificacion(
        { id: '12345678-1234-1234-1234-123456789021', asistencia_id: 'dummy', motivo: 'test' },
        metaSup,
        (err: any) => {
          if (!err) return reject(new Error('SUP no puede RegistrarJustificacion'));
          assert.strictEqual(err.code, grpc.status.PERMISSION_DENIED);
          assert.match(err.message, /fuera_de_alcance/);
          resolve();
        }
      );
    });

    // 3. SUP intenta RecalcularRiesgo -> PERMISSION_DENIED
    await new Promise<void>((resolve, reject) => {
      cliente.RecalcularRiesgo({ catequizando_id: CATEQUIZANDO_G1 }, metaSup, (err: any) => {
        if (!err) return reject(new Error('SUP no puede RecalcularRiesgo'));
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

test('RF-903: el servidor se detiene ordenadamente y libera los puertos', async () => {
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const salud = await verificarSalud(puerto, '127.0.0.1');
  assert.strictEqual(salud.status, 'SERVING');

  await servidor.detener(1000);

  // Al estar detenido, una nueva consulta debe fallar
  await assert.rejects(verificarSalud(puerto, '127.0.0.1'));
});

test.after(async () => {
  await pool.end().catch(() => {});
});
