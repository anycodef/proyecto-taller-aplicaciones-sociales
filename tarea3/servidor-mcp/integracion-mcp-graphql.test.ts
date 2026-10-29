/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import { crearEjecutorGraphql } from "./cliente-graphql.js";
import { crearServidorMcp } from "./servidor.js";

const nombresContrato = [
  "listar_riesgo_grupo",
  "consultar_catequizando",
  "resumen_asistencia_domingo",
  "registrar_asistencia",
  "registrar_justificacion",
  "recalcular_riesgo",
];

test("RF-909: cliente MCP sobre GraphQL doble coincide exactamente con el contrato", async (t) => {
  const solicitudes: { autorizacion: string | null; query: string }[] = [];
  const fetchDoble: typeof fetch = async (_entrada, inicio) => {
    const cuerpo = JSON.parse(String(inicio?.body)) as { query: string };
    solicitudes.push({
      autorizacion: new Headers(inicio?.headers).get("authorization"),
      query: cuerpo.query,
    });
    return new Response(JSON.stringify({
      data: {
        riesgoDelGrupo: [{
          catequizandoId: "00000000-0000-4000-8000-000000000001",
          nivel: "ALTO",
          motivo: "3 faltas consecutivas",
          calculadoEn: "2026-10-26T12:00:00Z",
        }],
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const servidor = crearServidorMcp(crearEjecutorGraphql({
    token: "token-integracion",
    fetch: fetchDoble,
  }));
  const cliente = new Client({ name: "prueba", version: "0.1.0" }, { capabilities: {} });
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(transporteServidor);
  await cliente.connect(transporteCliente);
  t.after(async () => void await Promise.allSettled([cliente.close(), servidor.close()]));

  const listado = await cliente.listTools();
  assert.deepEqual(listado.tools.map(({ name }) => name), nombresContrato);
  assert.equal(listado.tools.some(({ name }) => /borrar|eliminar/i.test(name)), false);

  const respuesta = await cliente.callTool(
    {
      name: "listar_riesgo_grupo",
      arguments: { grupoId: "00000000-0000-4000-8000-000000000003" },
    },
    CallToolResultSchema,
  );
  assert.equal(respuesta.isError, undefined);
  assert.equal(solicitudes[0]?.autorizacion, "Bearer token-integracion");
  assert.doesNotMatch(solicitudes[0]?.query ?? "", /salud|neurodivergencia|documento/i);
  assert.match(JSON.stringify(respuesta.content), /3 faltas consecutivas/);
});
