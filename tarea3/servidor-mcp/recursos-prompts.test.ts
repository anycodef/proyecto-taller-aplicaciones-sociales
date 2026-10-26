/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { crearServidorMcp } from "./servidor.js";

test("RF-909: expone el recurso de riesgo y lo resuelve para un grupo", async (t) => {
  const llamadas: { nombre: string; entrada: Record<string, unknown> }[] = [];
  const servidor = crearServidorMcp(async (nombre, entrada) => {
    llamadas.push({ nombre, entrada });
    return [{ catequizandoId: "cat-1", nivel: "ALTO" }];
  });
  const cliente = new Client({ name: "prueba", version: "0.1.0" }, { capabilities: {} });
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(transporteServidor);
  await cliente.connect(transporteCliente);
  t.after(async () => void await Promise.allSettled([cliente.close(), servidor.close()]));

  const plantillas = await cliente.listResourceTemplates();
  assert.equal(plantillas.resourceTemplates[0]?.uriTemplate, "sigecat://grupo/{grupoId}/riesgo");

  const grupoId = "00000000-0000-4000-8000-000000000003";
  const respuesta = await cliente.readResource({ uri: `sigecat://grupo/${grupoId}/riesgo` });
  assert.deepEqual(llamadas, [{
    nombre: "listar_riesgo_grupo",
    entrada: { grupoId, nivelMinimo: "MEDIO" },
  }]);
  assert.match(String(respuesta.contents[0]?.text ?? ""), /"nivel":"ALTO"/);
});

test("RF-909: publica el prompt revision-dominical con grupoId", async (t) => {
  const servidor = crearServidorMcp(async () => []);
  const cliente = new Client({ name: "prueba", version: "0.1.0" }, { capabilities: {} });
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(transporteServidor);
  await cliente.connect(transporteCliente);
  t.after(async () => void await Promise.allSettled([cliente.close(), servidor.close()]));

  const listado = await cliente.listPrompts();
  assert.equal(listado.prompts[0]?.name, "revision-dominical");
  const grupoId = "00000000-0000-4000-8000-000000000003";
  const prompt = await cliente.getPrompt({ name: "revision-dominical", arguments: { grupoId } });
  assert.match(prompt.messages[0]?.content.type === "text" ? prompt.messages[0].content.text : "", new RegExp(grupoId));
});
