/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { crearServidorMcp } from "./servidor.js";

test("RF-909: publica las tres herramientas MCP de lectura con sus anotaciones", async (t) => {
  const servidor = crearServidorMcp(async () => ({ ok: true }));
  const cliente = new Client(
    { name: "prueba-sigecat", version: "0.1.0" },
    { capabilities: {} },
  );
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();

  await servidor.connect(transporteServidor);
  await cliente.connect(transporteCliente);
  t.after(async () => {
    await Promise.allSettled([cliente.close(), servidor.close()]);
  });

  const respuesta = await cliente.listTools();

  assert.deepEqual(
    respuesta.tools.map(({ name }) => name),
    [
      "listar_riesgo_grupo",
      "consultar_catequizando",
      "resumen_asistencia_domingo",
    ],
  );
  for (const herramienta of respuesta.tools) {
    assert.deepEqual(herramienta.annotations, { readOnlyHint: true });
  }
});

test("RF-909: valida con Zod la entrada antes de ejecutar una herramienta", async (t) => {
  let cantidadEjecuciones = 0;
  const servidor = crearServidorMcp(async () => {
    cantidadEjecuciones += 1;
    return [];
  });
  const cliente = new Client(
    { name: "prueba-sigecat", version: "0.1.0" },
    { capabilities: {} },
  );
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();

  await servidor.connect(transporteServidor);
  await cliente.connect(transporteCliente);
  t.after(async () => {
    await Promise.allSettled([cliente.close(), servidor.close()]);
  });

  await assert.rejects(
    cliente.callTool({
      name: "listar_riesgo_grupo",
      arguments: { grupoId: "no-es-un-uuid" },
    }),
    /entrada de la herramienta no es válida/,
  );
  assert.equal(cantidadEjecuciones, 0);
});
