import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PasarLista } from "../src/application/PasarLista";
import { ObtenerHistorial } from "../src/application/ObtenerHistorial";
import { ErrorDeValidacion } from "../src/domain/errores";
import { DatosPaseDeLista, PaseDeLista } from "../src/domain/PaseDeLista";
import { RegistroRepositorioEnMemoria } from "../src/infrastructure/RegistroRepositorioEnMemoria";
import { SesionRepositorioEnMemoria } from "../src/infrastructure/SesionRepositorioEnMemoria";

const AHORA = new Date("2026-09-28T09:00:00.000Z");

function lote(sobrescribir: Partial<DatosPaseDeLista> = {}): DatosPaseDeLista {
  return {
    sesion: { id: "ses-1", grupoId: "grp-8", fecha: "2026-09-28", tipo: "misa", tema: "Prueba" },
    registros: [
      { id: "r-1", catequizandoId: "cat-001", estado: "presente" },
      { id: "r-2", catequizandoId: "cat-002", estado: "tardanza" },
      { id: "r-3", catequizandoId: "cat-003", estado: "ausente" },
    ],
    registradoPor: "C1",
    ...sobrescribir,
  };
}

function armar() {
  const sesiones = new SesionRepositorioEnMemoria();
  const registros = new RegistroRepositorioEnMemoria();
  return {
    pasarLista: new PasarLista(sesiones, registros, () => AHORA),
    historial: new ObtenerHistorial(sesiones, registros),
    registros,
  };
}

describe("PaseDeLista (dominio)", () => {
  it("crea la sesión y un registro por catequizando con el seudónimo de quien registra", () => {
    const pase = PaseDeLista.crear(lote(), AHORA);
    assert.equal(pase.sesion.id, "ses-1");
    assert.equal(pase.registros.length, 3);
    assert.ok(pase.registros.every((r) => r.sesionId === "ses-1" && r.registradoPor === "C1"));
    assert.ok(pase.registros.every((r) => r.registradoEn === AHORA.toISOString()));
  });

  it("respeta el instante que trae el cliente (cola offline)", () => {
    const pase = PaseDeLista.crear(
      lote({ registros: [{ id: "r-1", catequizandoId: "cat-001", estado: "presente", registradoEn: "2026-09-27T08:05:00Z" }] }),
      AHORA,
    );
    assert.equal(pase.registros[0]!.registradoEn, "2026-09-27T08:05:00.000Z");
  });

  it("rechaza estados, tipos y fechas inválidos", () => {
    assert.throws(() => PaseDeLista.crear(lote({ registros: [{ id: "r", catequizandoId: "c", estado: "faltó" }] }), AHORA), ErrorDeValidacion);
    assert.throws(() => PaseDeLista.crear(lote({ sesion: { id: "s", grupoId: "g", fecha: "2026-09-28", tipo: "retiro" } }), AHORA), ErrorDeValidacion);
    assert.throws(() => PaseDeLista.crear(lote({ sesion: { id: "s", grupoId: "g", fecha: "2026-02-30", tipo: "misa" } }), AHORA), ErrorDeValidacion);
    assert.throws(() => PaseDeLista.crear(lote({ sesion: { id: "s", grupoId: "g", fecha: "28/09/2026", tipo: "misa" } }), AHORA), ErrorDeValidacion);
  });

  it("rechaza lote vacío, sin registradoPor o con registros de otra sesión", () => {
    assert.throws(() => PaseDeLista.crear(lote({ registros: [] }), AHORA), ErrorDeValidacion);
    assert.throws(() => PaseDeLista.crear(lote({ registradoPor: "  " }), AHORA), ErrorDeValidacion);
    assert.throws(
      () => PaseDeLista.crear(lote({ registros: [{ id: "r", sesionId: "otra", catequizandoId: "c", estado: "presente" }] }), AHORA),
      ErrorDeValidacion,
    );
  });

  it("un catequizando no puede aparecer dos veces (con ids distintos) en la misma sesión", () => {
    const duplicado = lote({
      registros: [
        { id: "r-1", catequizandoId: "cat-001", estado: "presente" },
        { id: "r-2", catequizandoId: "cat-001", estado: "ausente" },
      ],
    });
    assert.throws(() => PaseDeLista.crear(duplicado, AHORA), ErrorDeValidacion);
  });

  it("el mismo id repetido dentro del lote es un solo registro", () => {
    const pase = PaseDeLista.crear(
      lote({
        registros: [
          { id: "r-1", catequizandoId: "cat-001", estado: "ausente" },
          { id: "r-1", catequizandoId: "cat-001", estado: "presente" },
        ],
      }),
      AHORA,
    );
    assert.equal(pase.registros.length, 1);
    assert.equal(pase.registros[0]!.estado, "presente");
  });
});

describe("PasarLista (idempotencia)", () => {
  it("devuelve sesionId y registrosGuardados", async () => {
    const { pasarLista } = armar();
    assert.deepEqual(await pasarLista.ejecutar(lote()), { sesionId: "ses-1", registrosGuardados: 3 });
  });

  it("reenviar el mismo lote no duplica nada", async () => {
    const { pasarLista, registros, historial } = armar();
    await pasarLista.ejecutar(lote());
    const segundo = await pasarLista.ejecutar(lote());

    assert.deepEqual(segundo, { sesionId: "ses-1", registrosGuardados: 3 });
    assert.equal((await registros.listarPorCatequizando("cat-003")).length, 1);
    assert.equal((await historial.ejecutar("cat-003")).length, 1);
  });

  it("reenviar con el mismo id y otro estado actualiza (upsert), no agrega", async () => {
    const { pasarLista, historial } = armar();
    await pasarLista.ejecutar(lote());
    await pasarLista.ejecutar(
      lote({ registros: [{ id: "r-3", catequizandoId: "cat-003", estado: "justificado" }] }),
    );
    assert.deepEqual(await historial.ejecutar("cat-003"), [{ fecha: "2026-09-28", tipo: "misa", estado: "justificado" }]);
  });

  it("un lote inválido no guarda nada", async () => {
    const { pasarLista, registros } = armar();
    await assert.rejects(
      pasarLista.ejecutar(lote({ registros: [{ id: "r-1", catequizandoId: "cat-001", estado: "presente" }, { id: "r-2", catequizandoId: "cat-002", estado: "?" }] })),
      ErrorDeValidacion,
    );
    assert.equal((await registros.listarPorCatequizando("cat-001")).length, 0);
  });
});
