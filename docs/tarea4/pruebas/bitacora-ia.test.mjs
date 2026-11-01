import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directorio = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const documento = readFileSync(resolve(directorio, 'bitacora-ia.md'), 'utf8');
const entradas = documento.split(/^### Uso \d+ — /m).slice(1);

function leerFuente(entrada) {
  const enlace = entrada.match(/\*\*Fuente:\*\* \[[^\]]+\]\(([^)]+)\)/);
  assert.ok(enlace, 'Cada uso debe enlazar su traza');
  return JSON.parse(readFileSync(resolve(directorio, enlace[1]), 'utf8'));
}

test('RF-1001: al menos doce usos distintos tienen todos los campos y tareas de sus trazas', () => {
  assert.ok(entradas.length >= 12);
  const tareas = new Set();
  for (const entrada of entradas) {
    for (const campo of ['Tarea', 'Fecha', 'Herramienta', 'Modelo', 'Resultado', 'Verificación histórica', 'Fuente']) {
      assert.ok(entrada.includes(`**${campo}:**`), `Falta ${campo}`);
    }
    assert.match(entrada, /\*\*Prompt (resumido|reconstruido):\*\* .+/);
    assert.match(entrada, /\*\*Resultado:\*\* (Aceptado|Modificado|Descartado)\./);
    const fuente = leerFuente(entrada);
    const declaradas = fuente.tarea ? [fuente.tarea] : fuente.tareas;
    assert.ok(declaradas?.length);
    const tarea = entrada.match(/\*\*Tarea:\*\* (.+)/)[1];
    const identificadores = tarea.match(/T\d{3}-\d+/g);
    assert.ok(identificadores?.length);
    for (const identificador of identificadores) assert.ok(declaradas.includes(identificador));
    tareas.add(tarea);
  }
  assert.equal(tareas.size, entradas.length, 'No se duplican tareas para alcanzar el mínimo');
});

test('RF-1002: se explicitan prompts reconstruidos, resultados inferidos y límites históricos', () => {
  assert.match(documento, /no es una transcripción del prompt original/);
  assert.match(documento, /no aprobación humana explícita/);
  assert.match(documento, /conteos acumulados o por lote no se suman/);
  assert.match(documento, /Comprobaciones actuales/);
  for (const entrada of entradas) {
    const fuente = leerFuente(entrada);
    if (!fuente.solicitud) assert.match(entrada, /\*\*Prompt reconstruido:/);
    const evidencia = fuente.resultados ?? fuente.verificacion;
    assert.ok(evidencia, 'La verificación debe tener respaldo en la traza');
  }
  assert.match(entradas.find(entrada => entrada.includes('backend-003.json')), /k6 no se ejecutó/);
  assert.match(entradas.find(entrada => entrada.includes('tarea3-p1.json')), /npm test fue parcial/);
});

test('RNF-1001: los enlaces resuelven y fecha, herramienta y modelo coinciden con la fuente', () => {
  for (const enlace of documento.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    assert.ok(existsSync(resolve(directorio, enlace[1])), `Enlace roto: ${enlace[1]}`);
  }
  for (const entrada of entradas) {
    const fuente = leerFuente(entrada);
    assert.ok(entrada.includes(`**Fecha:** ${fuente.fecha}.`));
    assert.ok(entrada.includes(`**Herramienta:** ${fuente.agente}.`));
    assert.ok(entrada.includes(`**Modelo:** \`${fuente.modelo}\`.`));
  }
});
