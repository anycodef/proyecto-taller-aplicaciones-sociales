import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cuentaComoFalta } from "../src/domain/EstadoAsistencia";
import { EstadoAsistencia } from "../src/domain/EstadoAsistencia";
import { RegistroAsistencia } from "../src/domain/RegistroAsistencia";
import { calcularSenalRiesgo, nivelSegunFaltas } from "../src/domain/SenalRiesgo";

const AHORA = new Date("2026-09-28T12:00:00.000Z");

/** Un registro por estado, cada uno en su propia sesión. */
function historial(...estados: EstadoAsistencia[]): RegistroAsistencia[] {
  return estados.map((estado, i) => ({
    id: `r${i}`,
    sesionId: `s${i}`,
    catequizandoId: "cat-x",
    estado,
    registradoPor: "C1",
    registradoEn: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
  }));
}

describe("qué cuenta como falta", () => {
  it("solo 'ausente' cuenta como falta", () => {
    assert.equal(cuentaComoFalta("ausente"), true);
    assert.equal(cuentaComoFalta("presente"), false);
    assert.equal(cuentaComoFalta("tardanza"), false);
    assert.equal(cuentaComoFalta("justificado"), false);
  });
});

describe("nivel de riesgo según faltas", () => {
  it("0–1 → bajo, 2 → medio, 3 o más → alto", () => {
    assert.equal(nivelSegunFaltas(0), "bajo");
    assert.equal(nivelSegunFaltas(1), "bajo");
    assert.equal(nivelSegunFaltas(2), "medio");
    assert.equal(nivelSegunFaltas(3), "alto");
    assert.equal(nivelSegunFaltas(7), "alto");
  });
});

describe("calcularSenalRiesgo", () => {
  it("sin historial es bajo", () => {
    const senal = calcularSenalRiesgo("cat-x", [], AHORA);
    assert.equal(senal.nivel, "bajo");
    assert.deepEqual(senal.motivos, ["0 ausencias sin justificar"]);
    assert.equal(senal.calculadoEn, "2026-09-28T12:00:00.000Z");
  });

  it("2 ausencias → medio", () => {
    const senal = calcularSenalRiesgo("cat-x", historial("ausente", "presente", "ausente"), AHORA);
    assert.equal(senal.nivel, "medio");
    assert.equal(senal.motivos[0], "2 ausencias sin justificar");
  });

  it("3 ausencias → alto, con el motivo del cálculo", () => {
    const senal = calcularSenalRiesgo("cat-x", historial("ausente", "ausente", "ausente"), AHORA);
    assert.equal(senal.nivel, "alto");
    assert.equal(senal.motivos[0], "3 ausencias sin justificar");
  });

  it("la tardanza NO cuenta como falta, por muchas que haya", () => {
    const senal = calcularSenalRiesgo("cat-x", historial("tardanza", "tardanza", "tardanza", "tardanza"), AHORA);
    assert.equal(senal.nivel, "bajo");
    assert.equal(senal.motivos[0], "0 ausencias sin justificar");
    assert.ok(senal.motivos.some((m) => m.startsWith("4 tardanzas")));
  });

  it("lo justificado NO suma faltas, por mucho que haya", () => {
    const senal = calcularSenalRiesgo("cat-x", historial("justificado", "justificado", "justificado"), AHORA);
    assert.equal(senal.nivel, "bajo");
    assert.equal(senal.motivos[0], "0 ausencias sin justificar");
    assert.ok(senal.motivos.some((m) => m.startsWith("3 ausencias justificadas")));
  });

  it("1 ausencia + 2 justificadas + 1 tardanza sigue siendo bajo", () => {
    const senal = calcularSenalRiesgo(
      "cat-x",
      historial("ausente", "justificado", "justificado", "tardanza", "presente"),
      AHORA,
    );
    assert.equal(senal.nivel, "bajo");
    assert.equal(senal.motivos[0], "1 ausencia sin justificar");
  });

  it("una tardanza o una justificación no empujan de medio a alto", () => {
    const senal = calcularSenalRiesgo(
      "cat-x",
      historial("ausente", "ausente", "tardanza", "justificado"),
      AHORA,
    );
    assert.equal(senal.nivel, "medio");
  });

  it("ignora registros de otros catequizandos", () => {
    const ajenos = historial("ausente", "ausente", "ausente").map((r) => ({ ...r, catequizandoId: "cat-otro" }));
    assert.equal(calcularSenalRiesgo("cat-x", ajenos, AHORA).nivel, "bajo");
  });

  it("si una sesión tiene dos registros (corrección con otro id), vale el más reciente", () => {
    const [original] = historial("ausente");
    const correccion: RegistroAsistencia = {
      ...original!,
      id: "r-corregido",
      estado: "justificado",
      registradoEn: "2026-09-02T10:00:00.000Z",
    };
    const senal = calcularSenalRiesgo("cat-x", [original!, correccion], AHORA);
    assert.equal(senal.motivos[0], "0 ausencias sin justificar");
  });
});
