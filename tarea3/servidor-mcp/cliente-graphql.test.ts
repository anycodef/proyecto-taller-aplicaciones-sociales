/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";

import { crearEjecutorGraphql } from "./cliente-graphql.js";

test("RF-909: el cliente GraphQL reenvía el token y pide solo campos de riesgo", async () => {
  let solicitud: { query: string; variables: Record<string, unknown> } | undefined;
  let autorizacion: string | null = null;
  const fetchDoble: typeof fetch = async (_entrada, inicio) => {
    autorizacion = new Headers(inicio?.headers).get("authorization");
    solicitud = JSON.parse(String(inicio?.body));
    return new Response(JSON.stringify({ data: { riesgoDelGrupo: [] } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const ejecutar = crearEjecutorGraphql({ token: "token-prueba", fetch: fetchDoble });

  await ejecutar("listar_riesgo_grupo", {
    grupoId: "00000000-0000-4000-8000-000000000001",
    nivelMinimo: "MEDIO",
  });

  assert.equal(autorizacion, "Bearer token-prueba");
  assert.match(solicitud?.query ?? "", /catequizandoId nivel motivo calculadoEn/);
  assert.doesNotMatch(solicitud?.query ?? "", /salud|neurodivergencia|documento/i);
});

test("RF-902: consultar catequizando omite asistencias cuando no se solicitan", async () => {
  let query = "";
  const fetchDoble: typeof fetch = async (_entrada, inicio) => {
    query = (JSON.parse(String(inicio?.body)) as { query: string }).query;
    return new Response(JSON.stringify({ data: { catequizando: { id: "cat-1" } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const ejecutar = crearEjecutorGraphql({ token: "token-prueba", fetch: fetchDoble });

  await ejecutar("consultar_catequizando", {
    catequizandoId: "00000000-0000-4000-8000-000000000001",
    incluirAsistencias: false,
  });

  assert.doesNotMatch(query, /asistencias\s*\{/);
  assert.match(query, /identidadOperativa/);
});

test("RF-905/RF-909: registrar asistencia envía el UUID generado en la entrada GraphQL", async () => {
  let solicitud: { query: string; variables: { entrada: Record<string, unknown> } } | undefined;
  const fetchDoble: typeof fetch = async (_entrada, inicio) => {
    solicitud = JSON.parse(String(inicio?.body));
    return new Response(JSON.stringify({
      data: { registrarAsistencia: { id: solicitud?.variables.entrada.id, repetido: false } },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const ejecutar = crearEjecutorGraphql({ token: "token-prueba", fetch: fetchDoble });

  const resultado = await ejecutar("registrar_asistencia", {
    id: "00000000-0000-4000-8000-000000000099",
    catequizandoId: "00000000-0000-4000-8000-000000000001",
    fecha: "2026-10-25",
    estado: "PRESENTE",
  });

  assert.match(solicitud?.query ?? "", /registrarAsistencia/);
  assert.equal(solicitud?.variables.entrada.id, "00000000-0000-4000-8000-000000000099");
  assert.deepEqual(resultado, {
    id: "00000000-0000-4000-8000-000000000099",
    repetido: false,
  });
});
