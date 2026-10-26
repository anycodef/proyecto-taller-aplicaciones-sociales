import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServidorActualizacion } from '../servidor.ts';
import { crearClienteActualizacion, crearMetadata } from '../cliente.ts';
import { emitirToken } from '../../compartido/auth.ts';
import { pool } from '../../compartido/bd.ts';
import { sembrar } from '../../scripts/bd-sembrar.mjs';

const GRUPO_1_ID = '11111111-1111-1111-1111-111111111101';
const CATEQUIZANDO_G1_1 = '22222222-2222-2222-2222-222222222101';
const CATEQUIZANDO_G1_2 = '22222222-2222-2222-2222-222222222102';
const CATEQUIZANDO_G2 = '22222222-2222-2222-2222-222222222201'; // fuera de alcance para CAT grupo 1

test('RF-903: RegistrarAsistenciaLote (client streaming) procesa lista en una transacción con conteos', async () => {
  await sembrar();
  const servidor = new ServidorActualizacion();
  const puerto = await servidor.iniciar({ host: '127.0.0.1', puerto: 0 });
  const cliente = crearClienteActualizacion(`127.0.0.1:${puerto}`);

  try {
    const tokenCat1 = await emitirToken({
      rol: 'CAT',
      grupoId: GRUPO_1_ID,
      identidadOperativa: 'Catequista María',
      sub: 'cat-maria-1',
    });
    const metadata = crearMetadata(tokenCat1);

    const id1 = '99999999-9999-9999-9999-999999999001';
    const id2 = '99999999-9999-9999-9999-999999999002';
    const idRepetido = id1; // Se enviará de nuevo para verificar conteo de repetidos
    const idRechazado = '99999999-9999-9999-9999-999999999003'; // Catequizando del grupo 2 -> rechazado

    const resumen = await new Promise<any>((resolve, reject) => {
      const llamada = cliente.RegistrarAsistenciaLote(metadata, (err: any, res: any) => {
        if (err) reject(err);
        else resolve(res);
      });

      // 1. Registro válido
      llamada.write({ id: id1, catequizando_id: CATEQUIZANDO_G1_1, fecha: '2026-11-29', estado: 1 });
      // 2. Otro registro válido
      llamada.write({ id: id2, catequizando_id: CATEQUIZANDO_G1_2, fecha: '2026-11-29', estado: 2 });
      // 3. Registro repetido (mismo id1)
      llamada.write({ id: idRepetido, catequizando_id: CATEQUIZANDO_G1_1, fecha: '2026-11-29', estado: 1 });
      // 4. Registro rechazado (catequizando de otro grupo)
      llamada.write({ id: idRechazado, catequizando_id: CATEQUIZANDO_G2, fecha: '2026-11-29', estado: 1 });
      // 5. Registro rechazado (campos vacíos)
      llamada.write({ id: '', catequizando_id: '', fecha: '', estado: 0 });

      llamada.end();
    });

    assert.strictEqual(resumen.registrados, 2);
    assert.strictEqual(resumen.repetidos, 1);
    assert.strictEqual(resumen.rechazados, 2);
  } finally {
    cliente.close();
    await servidor.detener();
  }
});

test.after(async () => {
  await pool.end().catch(() => {});
});

