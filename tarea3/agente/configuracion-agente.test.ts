/// <reference types="node" />

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raizTarea3 = new URL("../", import.meta.url);

test("RF-910: la configuración descubre el servidor MCP por stdio sin guardar el token", async () => {
  const texto = await readFile(new URL(".mcp.json", raizTarea3), "utf8");
  const configuracion = JSON.parse(texto) as {
    mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
  };
  const sigecat = configuracion.mcpServers?.sigecat;

  assert.equal(sigecat?.command, "node");
  assert.deepEqual(sigecat?.args, ["--import", "tsx", "servidor-mcp/principal.ts"]);
  assert.equal(sigecat?.env?.SIGECAT_TOKEN, "${SIGECAT_TOKEN}");
  assert.doesNotMatch(texto, /Bearer\s+[A-Za-z0-9_-]+/);
});

test("RF-910: el guion contiene consulta, escritura y verificación de riesgo", async () => {
  const guion = await readFile(new URL("agente/guion.md", raizTarea3), "utf8");
  assert.match(guion, /riesgo MEDIO o ALTO/);
  assert.match(guion, /Registra como PRESENTE/);
  assert.match(guion, /Recalcula su riesgo/);
  assert.match(guion, /usando solo las herramientas/);
});
