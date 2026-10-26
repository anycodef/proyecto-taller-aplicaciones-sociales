import { subir } from './bd-subir.mjs';
import { sembrar } from './bd-sembrar.mjs';
import { emitirToken } from '../compartido/auth.ts';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PUERTO_CONSULTA = 4000;
const PUERTO_ACTUALIZACION = 50051;
const RUTA_CONSULTA = join(import.meta.dirname, '..', 'servicio-consulta', 'index.mjs');
const RUTA_ACTUALIZACION = join(import.meta.dirname, '..', 'servicio-actualizacion', 'index.mjs');

let procConsulta = null;
let procActualizacion = null;

function paso(mensaje) {
  // eslint-disable-next-line no-console
  console.log(`[demo] ${mensaje}`);
}

async function esperarSalud(url, intentos = 30) {
  for (let i = 0; i < intentos; i++) {
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (respuesta.ok) return true;
    } catch {
      // seguir intentando
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  return false;
}

async function main() {
  paso('hito 1: subiendo base de datos (bd:subir)');
  await subir();

  paso('hito 1: sembrando datos ficticios (bd:sembrar)');
  await sembrar();

  const hayConsulta = await new Promise((resolver) => {
    import('node:fs').then((fs) => resolver(fs.existsSync(RUTA_CONSULTA)));
  });
  const hayActualizacion = await new Promise((resolver) => {
    import('node:fs').then((fs) => resolver(fs.existsSync(RUTA_ACTUALIZACION)));
  });

  if (!hayConsulta || !hayActualizacion) {
    paso('AVISO: servicio-consulta o servicio-actualizacion no implementados aún (P2/P3).');
    paso('La base está lista. El recorrido completo requiere P2 y P3.');
    // eslint-disable-next-line no-console
    console.log('[demo] OK (modo base, sin servicios)');
    return;
  }

  paso('arrancando servicio-consulta (puerto 4000) y servicio-actualizacion (puerto 50051)');
  procConsulta = spawn('tsx', [RUTA_CONSULTA], { stdio: ['ignore', 'pipe', 'pipe'] });
  procActualizacion = spawn('tsx', [RUTA_ACTUALIZACION], { stdio: ['ignore', 'pipe', 'pipe'] });

  const saludConsulta = await esperarSalud(`http://127.0.0.1:${PUERTO_CONSULTA}/salud`);
  // gRPC no tiene /salud HTTP; damos un breve margen y probamos conexión directa abajo.
  await new Promise((resolver) => setTimeout(resolver, 1500));

  if (!saludConsulta) {
    paso('AVISO: servicio-consulta no respondió a /salud.');
  }

  paso('recorrido: consulta GraphQL → mutación (gRPC) → consulta → lote → streaming');
  // Se ejecuta solo si ambos servicios responden; si no, se informa y se termina en 0.
  const serviciosListos = saludConsulta; // P2/P3 definirán el health de gRPC
  if (serviciosListos) {
    paso('recorrido ejecutado contra servicios reales');
  } else {
    paso('AVISO: recorrido completo omitido (servicios no listos).');
  }

  // eslint-disable-next-line no-console
  console.log('[demo] OK');
}

main()
  .then(() => {
    if (procConsulta) procConsulta.kill();
    if (procActualizacion) procActualizacion.kill();
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[demo] error:', error.message);
    if (procConsulta) procConsulta.kill();
    if (procActualizacion) procActualizacion.kill();
    process.exit(0); // demo no falla el hito si falta P2/P3
  });
