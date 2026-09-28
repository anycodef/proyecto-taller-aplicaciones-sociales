import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalcularRiesgo } from "../src/application/CalcularRiesgo";
import { ObtenerHistorial } from "../src/application/ObtenerHistorial";
import { generarSemilla, sembrar } from "../src/infrastructure/semilla";

import { ALMACENES, Almacen } from "./almacenes";

const AHORA = new Date("2026-09-28T12:00:00.000Z");

async function armar({ sesiones, registros }: Almacen) {
  await sembrar(sesiones, registros);
  return { riesgo: new CalcularRiesgo(registros, () => AHORA), historial: new ObtenerHistorial(sesiones, registros) };
}

for (const { nombre, crear } of ALMACENES) describe(`semilla: riesgos exactos del SPEC §3 — ${nombre}`, () => {
  it("cat-003 → medio (2 ausencias)", async () => {
    const { riesgo } = await armar(crear());
    const senal = await riesgo.ejecutar("cat-003");
    assert.equal(senal.nivel, "medio");
    assert.equal(senal.motivos[0], "2 ausencias sin justificar");
  });

  it("cat-007 → alto (3 ausencias)", async () => {
    const { riesgo } = await armar(crear());
    const senal = await riesgo.ejecutar("cat-007");
    assert.equal(senal.nivel, "alto");
    assert.equal(senal.motivos[0], "3 ausencias sin justificar");
  });

  it("cat-005 → bajo (1 ausencia y 2 justificadas: las justificadas no suman)", async () => {
    const { riesgo, historial } = await armar(crear());
    assert.equal((await riesgo.ejecutar("cat-005")).nivel, "bajo");
    const estados = (await historial.ejecutar("cat-005")).map((h) => h.estado);
    assert.equal(estados.filter((e) => e === "ausente").length, 1);
    assert.equal(estados.filter((e) => e === "justificado").length, 2);
  });

  it("cat-002 → bajo (1 tardanza: cuenta como asistencia)", async () => {
    const { riesgo, historial } = await armar(crear());
    assert.equal((await riesgo.ejecutar("cat-002")).nivel, "bajo");
    const estados = (await historial.ejecutar("cat-002")).map((h) => h.estado);
    assert.equal(estados.filter((e) => e === "tardanza").length, 1);
    assert.equal(estados.filter((e) => e === "ausente").length, 0);
  });

  it("el resto de catequizandos no cruza el umbral de conversación", async () => {
    const { riesgo } = await armar(crear());
    for (const id of ["cat-001", "cat-004", "cat-006", "cat-008", "cat-009", "cat-010", "cat-011", "cat-012"]) {
      assert.equal((await riesgo.ejecutar(id)).nivel, "bajo", id);
    }
  });
});

describe("semilla: forma de los datos", () => {
  const { crear } = ALMACENES[0]!;
  it("mezcla misa y catequesis, todas antes del 2026-09-28, en los cinco grupos", () => {
    const { sesiones } = generarSemilla();
    assert.ok(sesiones.some((s) => s.tipo === "misa"));
    assert.ok(sesiones.some((s) => s.tipo === "catequesis"));
    assert.ok(sesiones.every((s) => s.fecha < "2026-09-28"));
    assert.deepEqual([...new Set(sesiones.map((s) => s.grupoId))].sort(), ["grp-10", "grp-11-13-h", "grp-11-13-m", "grp-8", "grp-9"]);
  });

  it("ids únicos y referencias por identidad consistentes", () => {
    const { sesiones, registros } = generarSemilla();
    assert.equal(new Set(sesiones.map((s) => s.id)).size, sesiones.length);
    assert.equal(new Set(registros.map((r) => r.id)).size, registros.length);
    const ids = new Set(sesiones.map((s) => s.id));
    assert.ok(registros.every((r) => ids.has(r.sesionId)));
    assert.equal(new Set(registros.map((r) => r.catequizandoId)).size, 12);
  });

  it("el historial sale ordenado por fecha con {fecha, tipo, estado}", async () => {
    const { historial } = await armar(crear());
    const h = await historial.ejecutar("cat-007");
    assert.equal(h.length, 8);
    assert.deepEqual(Object.keys(h[0]!).sort(), ["estado", "fecha", "tipo"]);
    assert.deepEqual(h.map((x) => x.fecha), [...h.map((x) => x.fecha)].sort());
  });
});
