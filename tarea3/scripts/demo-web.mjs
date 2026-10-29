import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { emitirToken } from '../compartido/auth.ts';
import { subir } from './bd-subir.mjs';
import { sembrar } from './bd-sembrar.mjs';

const PUERTO_WEB = Number(process.env.PUERTO_DEMO_WEB ?? 4173);
const URL_GRAPHQL = `http://127.0.0.1:${process.env.PUERTO_CONSULTA ?? 4000}`;
const RUTA_INTERFAZ = join(import.meta.dirname, '..', 'interfaz-web');
const procesos = [];

const tiposContenido = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function informar(mensaje) {
  console.log(`[demo:web] ${mensaje}`);
}

function arrancarServicio(ruta, nombre) {
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

async function esperarSalud(intentos = 30) {
  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      const respuesta = await fetch(`${URL_GRAPHQL}/salud`, {
        signal: AbortSignal.timeout(1200),
      });
      if (respuesta.ok) return;
    } catch {
      // El proceso todavía está arrancando.
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  throw new Error('GraphQL no respondió a tiempo');
}

async function leerCuerpo(peticion) {
  const partes = [];
  let bytes = 0;
  for await (const parte of peticion) {
    bytes += parte.length;
    if (bytes > 100_000) throw new Error('La solicitud supera el límite de la demo');
    partes.push(parte);
  }
  return Buffer.concat(partes).toString('utf8');
}

function responderJson(respuesta, estado, contenido, cabeceras = {}) {
  respuesta.writeHead(estado, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...cabeceras,
  });
  respuesta.end(JSON.stringify(contenido));
}

async function servirArchivo(respuesta, nombre) {
  const ruta = join(RUTA_INTERFAZ, nombre);
  const contenido = await readFile(ruta);
  respuesta.writeHead(200, {
    'content-type': tiposContenido[extname(ruta)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  respuesta.end(contenido);
}

async function crearServidorVisual(token) {
  return createServer(async (peticion, respuesta) => {
    const url = new URL(peticion.url ?? '/', `http://${peticion.headers.host}`);
    try {
      if (peticion.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        await servirArchivo(respuesta, 'index.html');
        return;
      }
      if (peticion.method === 'GET' && url.pathname === '/estilos.css') {
        await servirArchivo(respuesta, 'estilos.css');
        return;
      }
      if (peticion.method === 'GET' && url.pathname === '/app.js') {
        await servirArchivo(respuesta, 'app.js');
        return;
      }
      if (peticion.method === 'GET' && url.pathname === '/api/estado') {
        const inicio = performance.now();
        const salud = await fetch(`${URL_GRAPHQL}/salud`).then((r) => r.json());
        responderJson(respuesta, 200, {
          baseDatos: 'conectada',
          grpc: procesos[0]?.exitCode === null ? 'activo' : 'detenido',
          graphql: salud.estado === 'ok' ? 'activo' : 'detenido',
          endpoint: `${URL_GRAPHQL}/graphql`,
          autenticacion: 'JWT COORD en memoria',
          duracionMs: Math.round(performance.now() - inicio),
        });
        return;
      }
      if (peticion.method === 'POST' && url.pathname === '/api/graphql') {
        const cuerpo = await leerCuerpo(peticion);
        JSON.parse(cuerpo);
        const inicio = performance.now();
        const resultado = await fetch(`${URL_GRAPHQL}/graphql`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: cuerpo,
        });
        const texto = await resultado.text();
        const duracionMs = Math.round(performance.now() - inicio);
        informar(`POST /graphql → ${resultado.status} (${duracionMs} ms)`);
        respuesta.writeHead(resultado.status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-sigecat-destino': `${URL_GRAPHQL}/graphql`,
          'x-sigecat-duracion-ms': String(duracionMs),
        });
        respuesta.end(texto);
        return;
      }
      responderJson(respuesta, 404, { error: 'Ruta no encontrada' });
    } catch (error) {
      responderJson(respuesta, 500, {
        error: error instanceof Error ? error.message : 'Error inesperado',
      });
    }
  });
}

async function detener(servidorWeb) {
  await new Promise((resolver) => servidorWeb.close(resolver));
  for (const proceso of procesos) {
    if (proceso.exitCode === null) proceso.kill();
  }
}

async function principal() {
  informar('preparando esquema y datos ficticios');
  await subir();
  await sembrar();

  informar('arrancando gRPC y GraphQL reales');
  arrancarServicio(join(import.meta.dirname, '..', 'servicio-actualizacion', 'index.mjs'), 'gRPC');
  arrancarServicio(join(import.meta.dirname, '..', 'servicio-consulta', 'index.mjs'), 'GraphQL');
  await esperarSalud();

  const token = await emitirToken({
    rol: 'COORD',
    identidadOperativa: 'Coordinación Demo Web',
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  const servidorWeb = await crearServidorVisual(token);
  servidorWeb.listen(PUERTO_WEB, '127.0.0.1', () => {
    informar(`interfaz disponible en http://127.0.0.1:${PUERTO_WEB}`);
    informar('presiona Ctrl+C para detener todos los servicios');
  });

  const apagar = async () => {
    informar('cerrando demo');
    await detener(servidorWeb);
    process.exit(0);
  };
  process.once('SIGINT', apagar);
  process.once('SIGTERM', apagar);
}

principal().catch(async (error) => {
  console.error('[demo:web] error:', error instanceof Error ? error.message : error);
  for (const proceso of procesos) {
    if (proceso.exitCode === null) proceso.kill();
  }
  process.exit(1);
});
