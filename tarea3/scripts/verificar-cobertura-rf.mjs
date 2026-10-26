import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Escanea tarea3/ y cuenta qué RF-9xx de la spec 009 tienen al menos un test
// que cita su identificador en su nombre (pruebas-e2e/*.test.ts).
// RF: RNF-905 (trazabilidad: cada RF tiene un test con su identificador).

const DIRECTORIO_PRUEBAS = join(import.meta.dirname, '..', 'pruebas-e2e');

// RF de la spec 009 que P5 puede cubrir desde tarea3/ (los de P1/P2/P3/P4 se reportan como "de otra persona").
const RF_ESPERADOS_P5 = [
  'RF-902', // Consulta GraphQL
  'RF-903', // Actualización gRPC
  'RF-904', // Mutaciones por GraphQL
  'RF-905', // Idempotencia
  'RF-906', // Autorización por rol
  'RF-907', // Datos protegidos
  'RF-908', // Riesgo calculado
  'RF-912', // Demo en un comando
  'RF-913', // Evidencia (parcial: scripts de orquestación)
];

function leerTests() {
  const archivos = [];
  let entries = [];
  try {
    entries = readdirSync(DIRECTORIO_PRUEBAS);
  } catch {
    // no hay carpeta de pruebas aún
  }
  for (const entry of entries) {
    if (entry.endsWith('.test.ts')) archivos.push(join(DIRECTORIO_PRUEBAS, entry));
  }
  return archivos;
}

function identificadoresRF(contenido) {
  const encontrados = new Set();
  const regex = /RF-9\d\d/g;
  let coincidencia;
  while ((coincidencia = regex.exec(contenido)) !== null) {
    encontrados.add(coincidencia[0]);
  }
  return encontrados;
}

export async function verificar() {
  const archivos = leerTests();
  let textoCompleto = '';
  for (const archivo of archivos) {
    textoCompleto += await readFile(archivo, 'utf8') + '\n';
  }
  const encontrados = identificadoresRF(textoCompleto);

  // eslint-disable-next-line no-console
  console.log('=== Cobertura de RF sobre tarea3/ (spec 009) ===');
  // eslint-disable-next-line no-console
  console.log(`Archivos de prueba escaneados: ${archivos.length}`);
  // eslint-disable-next-line no-console
  console.log(`Identificadores RF-9xx citados: ${[...encontrados].sort().join(', ') || '(ninguno)'}`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('RF esperados de P5 en tarea3/:');
  let faltan = 0;
  for (const rf of RF_ESPERADOS_P5) {
    const tiene = encontrados.has(rf);
    if (!tiene) faltan += 1;
    // eslint-disable-next-line no-console
    console.log(`  ${tiene ? '✓' : '✗'} ${rf}`);
  }
  // eslint-disable-next-line no-console
  console.log('');
  if (faltan === 0) {
    // eslint-disable-next-line no-console
    console.log('RESULTADO: todos los RF de P5 en tarea3/ tienen al menos un test.');
    return 0;
  }
  // eslint-disable-next-line no-console
  console.log(`RESULTADO: ${faltan} RF de P5 aún sin test en tarea3/.`);
  return 1;
}

if (process.argv[1] && process.argv[1].endsWith('verificar-cobertura-rf.mjs')) {
  const codigo = await verificar();
  process.exit(codigo);
}
