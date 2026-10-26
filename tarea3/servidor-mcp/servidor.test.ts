/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import { crearServidorMcp } from "./servidor.js";

test("RF-909: publica las herramientas MCP de lectura con sus anotaciones", async (t) => {
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
    respuesta.tools.slice(0, 3).map(({ name }) => name),
    [
      "listar_riesgo_grupo",
      "consultar_catequizando",
      "resumen_asistencia_domingo",
    ],
  );
  for (const herramienta of respuesta.tools.slice(0, 3)) {
    assert.deepEqual(herramienta.annotations, { readOnlyHint: true });
  }
});

test("RF-905/RF-909: genera UUID y publica escrituras idempotentes no destructivas", async (t) => {
  let entradaEjecutada: Record<string, unknown> | undefined;
  const servidor = crearServidorMcp(async (_nombre, entrada) => {
    entradaEjecutada = entrada;
    return { id: entrada.id, repetido: false };
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

  const listado = await cliente.listTools();
  const escrituras = listado.tools.slice(3);
  assert.deepEqual(escrituras.map(({ name }) => name), [
    "registrar_asistencia",
    "registrar_justificacion",
    "recalcular_riesgo",
  ]);
  for (const herramienta of escrituras) {
    assert.deepEqual(herramienta.annotations, {
      destructiveHint: false,
      idempotentHint: true,
    });
  }

  const respuesta = await cliente.callTool(
    {
      name: "registrar_asistencia",
      arguments: {
        catequizandoId: "00000000-0000-4000-8000-000000000001",
        fecha: "2026-10-25",
        estado: "PRESENTE",
      },
    },
    CallToolResultSchema,
  );
  assert.match(String(entradaEjecutada?.id), /^[0-9a-f-]{36}$/);
  const contenido = respuesta.content as { type: string; text?: string }[];
  assert.match(contenido[0]?.type === "text" ? contenido[0].text ?? "" : "", /repetido/);
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
