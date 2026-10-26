import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { emitirToken } from '../compartido/auth.ts';
import { subir } from './bd-subir.mjs';
import { sembrar } from './bd-sembrar.mjs';

const PUERTO_CONSULTA = 4000;
const GRUPO_ID = '11111111-1111-1111-1111-111111111101';
const CATEQUIZANDO_ID = '22222222-2222-2222-2222-222222222101';
const FECHA = '2026-11-15';
const RUTA_CONSULTA = join(import.meta.dirname, '..', 'servicio-consulta', 'index.mjs');
const RUTA_ACTUALIZACION = join(import.meta.dirname, '..', 'servicio-actualizacion', 'index.mjs');
const RUTA_PROTO = join(import.meta.dirname, '..', 'contratos', 'sigecat.proto');

const procesos = [];

function paso(mensaje) {
  console.log(`[demo] ${mensaje}`);
}

function arrancar(ruta, nombre) {
  const proceso = spawn(process.execPath, ['--import', 'tsx', ruta], {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proceso.stdout.on('data', (datos) => process.stdout.write(`[${nombre}] ${datos}`));
  proceso.stderr.on('data', (datos) => process.stderr.write(`[${nombre}] ${datos}`));
  procesos.push(proceso);
  return proceso;
}

async function esperarSalud(url, intentos = 30) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (respuesta.ok) return;
    } catch {
      // El proceso aún está arrancando.
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  throw new Error(`el servicio no respondió a ${url}`);
}

async function graphql(token, query, variables = {}) {
  const respuesta = await fetch(`http://127.0.0.1:${PUERTO_CONSULTA}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok || cuerpo.errors?.length) {
    throw new Error(`GraphQL rechazó el paso: ${JSON.stringify(cuerpo.errors ?? cuerpo)}`);
  }
  return cuerpo.data;
}

function crearClienteGrpc(token) {
  const definicion = protoLoader.loadSync(RUTA_PROTO, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const objeto = grpc.loadPackageDefinition(definicion);
  const Servicio = objeto.sigecat.actualizacion.v1.Actualizacion;
  const cliente = new Servicio('127.0.0.1:50051', grpc.credentials.createInsecure());
  const metadata = new grpc.Metadata();
  metadata.set('authorization', `Bearer ${token}`);
  return { cliente, metadata };
}

async function registrarLote(cliente, metadata) {
  return new Promise((resolver, rechazar) => {
    const llamada = cliente.RegistrarAsistenciaLote(metadata, (error, respuesta) => {
      if (error) rechazar(error);
      else resolver(respuesta);
    });
    llamada.write({ id: randomUUID(), catequizando_id: CATEQUIZANDO_ID, fecha: FECHA, estado: 1 });
    llamada.write({ id: randomUUID(), catequizando_id: CATEQUIZANDO_ID, fecha: FECHA, estado: 1 });
    llamada.end();
  });
}

async function observarUnEvento(cliente, metadata, provocarEvento) {
  return new Promise((resolver, rechazar) => {
    const llamada = cliente.ObservarAsistencia({ grupo_id: GRUPO_ID }, metadata);
    const temporizador = setTimeout(() => {
      llamada.cancel();
      rechazar(new Error('el streaming no recibió un evento en 5 segundos'));
    }, 5000);
    llamada.once('data', (evento) => {
      clearTimeout(temporizador);
      resolver(evento);
      llamada.cancel();
    });
    llamada.on('error', (error) => {
      if (error.code !== grpc.status.CANCELLED) {
        clearTimeout(temporizador);
        rechazar(error);
      }
    });
    setTimeout(() => provocarEvento().catch(rechazar), 300);
  });
}

async function ejecutarRecorrido() {
  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinación Demo',
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });

  paso('1/5 consulta GraphQL de catequizandos');
  const consulta = await graphql(
    token,
    'query($grupoId: ID!) { catequizandos(grupoId: $grupoId) { total nodos { id identidadOperativa } } }',
    { grupoId: GRUPO_ID },
  );
  paso(`1/5 consulta completada: ${consulta.catequizandos.total} catequizandos`);

  paso('2/5 mutación GraphQL delegada por gRPC');
  const id = randomUUID();
  const mutacion = await graphql(
    token,
    'mutation($entrada: RegistrarAsistenciaEntrada!) { registrarAsistencia(entrada: $entrada) { id repetido } }',
    { entrada: { id, catequizandoId: CATEQUIZANDO_ID, fecha: FECHA, estado: 'PRESENTE' } },
  );
  paso(`2/5 mutación completada: id=${mutacion.registrarAsistencia.id}, repetido=${mutacion.registrarAsistencia.repetido}`);

  paso('3/5 consulta GraphQL posterior a la mutación');
  const posterior = await graphql(
    token,
    'query($id: ID!, $fecha: FechaCivil!) { catequizando(id: $id) { asistencias(desde: $fecha, hasta: $fecha) { id estado } } }',
    { id: CATEQUIZANDO_ID, fecha: FECHA },
  );
  const reflejado = posterior.catequizando.asistencias.some((asistencia) => asistencia.id === id);
  if (!reflejado) throw new Error('la consulta posterior no reflejó la escritura');
  paso('3/5 consulta posterior confirmó la escritura');

  const { cliente, metadata } = crearClienteGrpc(token);
  try {
    paso('4/5 lote gRPC client streaming');
    const lote = await registrarLote(cliente, metadata);
    paso(`4/5 lote completado: registrados=${lote.registrados}, repetidos=${lote.repetidos}`);

    paso('5/5 observación gRPC server streaming');
    const evento = await observarUnEvento(cliente, metadata, async () => {
      await graphql(
        token,
        'mutation($entrada: RegistrarAsistenciaEntrada!) { registrarAsistencia(entrada: $entrada) { id } }',
        { entrada: { id: randomUUID(), catequizandoId: CATEQUIZANDO_ID, fecha: FECHA, estado: 'PRESENTE' } },
      );
    });
    paso(`5/5 streaming recibió asistencia=${evento.asistencia_id}`);
  } finally {
    cliente.close();
  }
}

async function detenerProcesos() {
  for (const proceso of procesos) {
    if (proceso.exitCode === null) proceso.kill();
  }
  await Promise.all(
    procesos.map((proceso) =>
      proceso.exitCode === null
        ? new Promise((resolver) => proceso.once('exit', resolver))
        : Promise.resolve(),
    ),
  );
}

async function main() {
  if (!existsSync(RUTA_CONSULTA) || !existsSync(RUTA_ACTUALIZACION)) {
    throw new Error('faltan servicio-consulta o servicio-actualizacion');
  }

  paso('subiendo base de datos');
  await subir();
  paso('sembrando datos ficticios');
  await sembrar();

  paso('arrancando servicios GraphQL y gRPC');
  arrancar(RUTA_ACTUALIZACION, 'actualización');
  arrancar(RUTA_CONSULTA, 'consulta');
  await esperarSalud(`http://127.0.0.1:${PUERTO_CONSULTA}/salud`);
  await ejecutarRecorrido();
  paso('OK: recorrido completo contra servicios reales');
}

try {
  await main();
} catch (error) {
  console.error('[demo] error:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await detenerProcesos();
}
