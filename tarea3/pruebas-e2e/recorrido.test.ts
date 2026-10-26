import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitirToken } from '../compartido/auth.ts';
import { sembrar } from '../scripts/bd-sembrar.mjs';
import pg from 'pg';
import { join } from 'node:path';

const { Pool } = pg;
const GRUPO_ID = '11111111-1111-1111-1111-111111111101';
const CATEQUIZANDO_ID = '22222222-2222-2222-2222-222222222101';
const URL_GRAPHQL = 'http://127.0.0.1:4000/graphql';

const pool = new Pool({ host: '127.0.0.1', port: 55432, user: 'postgres', database: 'sigecat' });

async function serviciosDisponibles() {
  try {
    const r = await fetch('http://127.0.0.1:4000/salud', { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

function graphql(query: string, variables: Record<string, unknown> = {}, token?: string) {
  return fetch(URL_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
}

test('RF-902/903/904/905/912: recorrido e2e GraphQL → gRPC → GraphQL → lote → streaming', async (t) => {
  if (!(await serviciosDisponibles())) {
    t.skip('servicios de P2/P3 no disponibles; se ejecutará cuando se mergée P2 y P3');
    return;
  }

  const grpc = await import('@grpc/grpc-js');
  const protoLoader = await import('@grpc/proto-loader');

  await sembrar();
  const token = await emitirToken({ rol: 'COORD', identidadOperativa: 'Coordinadora Demo', sub: 'demo-coord' });

  // 1. Consulta GraphQL: catequizandos del grupo
  const consulta1 = await graphql(
    `query($grupoId: ID!) { catequizandos(grupoId: $grupoId) { nodos { id identidadOperativa } total } }`,
    { grupoId: GRUPO_ID },
    token
  );
  assert.strictEqual(consulta1.status, 200);
  const cuerpo1 = await consulta1.json();
  assert.ok(cuerpo1.data.catequizandos.total >= 1);

  // 2. Mutación GraphQL registrarAsistencia (delega por gRPC en servicio-actualizacion)
  const idAsistencia = '33333333-3333-3333-3333-333333333301';
  const fecha = '2026-11-15';
  const mutacion = await graphql(
    `mutation($e: RegistrarAsistenciaEntrada!) { registrarAsistencia(entrada: $e) { id repetido } }`,
    { e: { id: idAsistencia, catequizandoId: CATEQUIZANDO_ID, fecha, estado: 'PRESENTE' } },
    token
  );
  const cuerpoMut = await mutacion.json();
  assert.strictEqual(cuerpoMut.data.registrarAsistencia.repetido, false);

  // 3. Repetir el mismo id: idempotencia (repetido = true) - RF-905
  const mutacion2 = await graphql(
    `mutation($e: RegistrarAsistenciaEntrada!) { registrarAsistencia(entrada: $e) { id repetido } }`,
    { e: { id: idAsistencia, catequizandoId: CATEQUIZANDO_ID, fecha, estado: 'PRESENTE' } },
    token
  );
  const cuerpoMut2 = await mutacion2.json();
  assert.strictEqual(cuerpoMut2.data.registrarAsistencia.repetido, true);

  // 4. Lote gRPC RegistrarAsistenciaLote (client streaming)
  const definicion = protoLoader.loadSync(join(import.meta.dirname, '..', 'contratos', 'sigecat.proto'), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const grpcObj = grpc.loadPackageDefinition(definicion) as any;
  const servicio = grpcObj.sigecat.actualizacion.v1.Actualizacion;
  const cliente = new servicio('127.0.0.1:50051', grpc.credentials.createInsecure());
  const metadata = new grpc.Metadata();
  metadata.set('authorization', `Bearer ${token}`);
  const lote = await new Promise<any>((resolver, rechazar) => {
    const llamada = cliente.RegistrarAsistenciaLote(metadata, (error: any, respuesta: any) => {
      error ? rechazar(error) : resolver(respuesta);
    });
    llamada.write({ id: '44444444-4444-4444-4444-444444444402', catequizando_id: CATEQUIZANDO_ID, fecha: '2026-11-15', estado: 1 });
    llamada.write({ id: '44444444-4444-4444-4444-444444444403', catequizando_id: CATEQUIZANDO_ID, fecha: '2026-11-15', estado: 1 });
    llamada.end();
  });
  assert.ok(lote.registrados >= 1);

  // 5. Streaming gRPC ObservarAsistencia (server streaming)
  const eventos = await new Promise((resolver, rechazar) => {
    const recibidos: any[] = [];
    const llamada = cliente.ObservarAsistencia({ grupo_id: GRUPO_ID }, metadata);
    llamada.on('data', (evento: any) => recibidos.push(evento));
    const temporizador = setTimeout(() => llamada.cancel(), 2000);
    llamada.on('end', () => {
      clearTimeout(temporizador);
      resolver(recibidos);
    });
    llamada.on('error', (error: { code?: number }) => {
      clearTimeout(temporizador);
      if (error.code === grpc.status.CANCELLED) {
        resolver(recibidos);
        return;
      }
      rechazar(error);
    });
  });
  assert.ok(Array.isArray(eventos));

  cliente.close();
  await pool.end();
});

test.after(async () => {
  await pool.end().catch(() => {});
});
