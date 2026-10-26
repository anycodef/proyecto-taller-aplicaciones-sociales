import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const leer = (ruta) => readFileSync(resolve(raiz, ruta), "utf8");
const existe = (ruta) => existsSync(resolve(raiz, ruta));

test("RF-901 inventario y matriz cubren las funcionalidades y R1-R27", () => {
  const inventario = leer("docs/tarea-3/inventario-funcionalidades.md");
  assert.match(inventario, /F-20/);

  const matriz = leer("docs/tarea-3/matriz-aplicabilidad.md");
  assert.match(matriz, /Dónde sí y dónde no/);
  assert.match(matriz, /GraphQL/);
  assert.match(matriz, /gRPC/);

  for (let numero = 1; numero <= 27; numero += 1) {
    assert.match(matriz, new RegExp(`\\bR${numero}\\b`));
  }
});

test("RF-911 la decisión MCP compara los tres caminos y publica la medición", () => {
  const decision = leer("docs/tarea-3/decision-agente-mcp.md");
  for (const concepto of [
    "GraphQL",
    "gRPC",
    "MCP",
    "Descubrimiento",
    "Consumo de contexto/tokens",
    "Seguridad y alcance",
    "Costo de integración",
  ]) {
    assert.ok(decision.includes(concepto), `Falta el concepto: ${concepto}`);
  }
  assert.match(decision, /no es una medición e2e/i);

  const salida = leer("docs/tarea-3/medicion/salida-medicion.md");
  assert.match(salida, /MCP: listar_riesgo_grupo/);
  assert.match(salida, /1,976/);
  assert.match(salida, /142/);
});

test("RF-912 el diagrama C4 y las secuencias están en DSL y en el informe", () => {
  const rutaDsl = "docs/diagrams/tarea3-demo-c4.dsl";
  assert.ok(existe(rutaDsl), "Falta el DSL de la demo");

  const dsl = leer(rutaDsl);
  assert.match(dsl, /ContenedoresDemoTarea3/);
  assert.match(dsl, /SecuenciaConsultaRiesgoMCP/);
  assert.match(dsl, /SecuenciaEscrituraYStreaming/);

  const informe = leer("docs/tarea-3/informe.md");
  assert.match(informe, /```mermaid/);
  assert.match(informe, /flowchart LR/);
  assert.match(informe, /sequenceDiagram/);
});

test("RF-913 el informe y el guion distinguen lo verificado de lo pendiente", () => {
  const informe = leer("docs/tarea-3/informe.md");
  for (const seccion of [
    "## 1. Resumen ejecutivo",
    "## 3. Dónde sí y dónde no",
    "## 4. Arquitectura esperada de la demo",
    "## 6. Trabajo del equipo y commits",
    "## 7. Verificación",
    "## 8. Riesgos y pendientes",
  ]) {
    assert.ok(informe.includes(seccion), `Falta la sección: ${seccion}`);
  }
  assert.match(informe, /npm test/);
  assert.match(informe, /PASÓ/);
  assert.match(informe, /P2 \| Servicio de consulta GraphQL \| T009-21 a T009-28/);
  assert.match(informe, /Producción.*demo local/s);

  const guion = leer("docs/tarea-3/guion-exposicion.md");
  assert.match(guion, /10 minutos/);
  assert.match(guion, /Checklist de ensayo/);
  assert.match(guion, /\| P1 \|/);
  assert.match(guion, /\| P5 \|/);
  assert.match(guion, /evidencia previa/);
});
