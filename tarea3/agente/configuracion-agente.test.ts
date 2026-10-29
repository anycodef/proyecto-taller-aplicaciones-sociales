/// <reference types="node" />

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raizTarea3 = new URL("../", import.meta.url);
const raizRepositorio = new URL("../../", import.meta.url);

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

test("RF-910: OpenCode descubre el mismo servidor MCP sin guardar el token", async () => {
  const texto = await readFile(new URL("opencode.json", raizRepositorio), "utf8");
  const configuracion = JSON.parse(texto) as {
    mcp?: Record<
      string,
      {
        type?: string;
        command?: string[];
        cwd?: string;
        enabled?: boolean;
        environment?: Record<string, string>;
      }
    >;
  };
  const sigecat = configuracion.mcp?.sigecat;

  assert.equal(sigecat?.type, "local");
  assert.deepEqual(sigecat?.command, ["node", "--import", "tsx", "servidor-mcp/principal.ts"]);
  assert.equal(sigecat?.cwd, "tarea3");
  assert.equal(sigecat?.enabled, true);
  assert.equal(sigecat?.environment?.SIGECAT_TOKEN, "{env:SIGECAT_TOKEN}");
  assert.doesNotMatch(texto, /Bearer\s+[A-Za-z0-9_-]+/);
});

test("RF-910: el guion contiene consulta, escritura y verificación de riesgo", async () => {
  const guion = await readFile(new URL("agente/guion.md", raizTarea3), "utf8");
  assert.match(guion, /riesgo MEDIO o ALTO/);
  assert.match(guion, /Registra como PRESENTE/);
  assert.match(guion, /Recalcula su riesgo/);
  assert.match(guion, /usando solo las herramientas/);
});

test("RF-910: la evidencia conserva la ejecución real y su medición", async () => {
  const transcripcion = await readFile(
    new URL("evidencia/agente-transcripcion.md", raizTarea3),
    "utf8",
  );
  const medicion = await readFile(new URL("evidencia/medicion-agente.md", raizTarea3), "utf8");

  assert.match(transcripcion, /Claude Code 2\.1\.310/);
  assert.match(transcripcion, /listar_riesgo_grupo/);
  assert.match(transcripcion, /registrar_asistencia/);
  assert.match(transcripcion, /recalcular_riesgo/);
  assert.match(transcripcion, /0a651c86-553e-4ce6-b451-4648ba80054b/);
  assert.match(medicion, /MCP, contenido de herramienta \| `\[\]` \| 2/);
  assert.match(medicion, /GraphQL, respuesta HTTP cruda .* \| 30/);
});
