import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ_TAREA3 = join(import.meta.dirname, '..');
const DIRECTORIOS_PRUEBAS = [
  join(RAIZ_TAREA3, 'pruebas-e2e'),
  join(RAIZ_TAREA3, 'servicio-actualizacion', 'pruebas'),
  join(RAIZ_TAREA3, 'servicio-consulta', 'pruebas'),
  join(RAIZ_TAREA3, 'servidor-mcp'),
  join(RAIZ_TAREA3, 'agente'),
  join(RAIZ_TAREA3, '..', 'docs', 'tarea-3', 'pruebas'),
];
const RF_ESPERADOS = Array.from({ length: 13 }, (_, indice) => `RF-${901 + indice}`);

function leerTests(directorio) {
  try {
    return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
      const ruta = join(directorio, entrada.name);
      if (entrada.isDirectory()) return leerTests(ruta);
      return /\.test\.(?:ts|mjs)$/.test(entrada.name) ? [ruta] : [];
    });
  } catch {
    return [];
  }
}

function identificadoresRF(contenido) {
  return new Set(contenido.match(/RF-9\d\d/g) ?? []);
}

export async function verificar() {
  const archivos = DIRECTORIOS_PRUEBAS.flatMap(leerTests);
  const contenidos = await Promise.all(archivos.map((archivo) => readFile(archivo, 'utf8')));
  const encontrados = identificadoresRF(contenidos.join('\n'));

  console.log('=== Cobertura de RF sobre la Tarea 3 ===');
  console.log(`Archivos de prueba escaneados: ${archivos.length}`);
  console.log(`Identificadores citados: ${[...encontrados].sort().join(', ') || '(ninguno)'}`);
  console.log('');

  const faltantes = RF_ESPERADOS.filter((rf) => !encontrados.has(rf));
  for (const rf of RF_ESPERADOS) console.log(`  ${encontrados.has(rf) ? '✓' : '✗'} ${rf}`);
  console.log('');

  if (faltantes.length === 0) {
    console.log('RESULTADO: RF-901 a RF-913 tienen al menos un test que cita su identificador.');
    return 0;
  }
  console.log(`RESULTADO: faltan ${faltantes.join(', ')}.`);
  return 1;
}

if (process.argv[1]?.endsWith('verificar-cobertura-rf.mjs')) {
  process.exitCode = await verificar();
}
