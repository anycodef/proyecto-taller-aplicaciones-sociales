import { explicarPaso, tituloDePaso, type EntradaExplicable } from "../explicacion";
import type { FaltaClasificada } from "../tipos";

const falta = (fecha: string, estado: FaltaClasificada["estado"], origen: FaltaClasificada["origen"] = "domingo", cantidad?: number): FaltaClasificada => ({
  catequizandoId: "n1", fecha, origen, estado, sesionIds: ["s"], ...(cantidad ? { cantidad } : {}),
});
const entrada = (cambios: Partial<EntradaExplicable>): EntradaExplicable => ({ paso: "contacto", conteo: 2, sinFicha: true, pendientesJustificar: 0, faltasOrigen: [], ...cambios });

test("RNF-702: la alerta de retiro lista las fechas de las faltas que la originaron", () => {
  const e = explicarPaso(entrada({
    paso: "alerta_retiro", conteo: 4, sinFicha: false,
    faltasOrigen: [falta("2026-11-08", "suma"), falta("2026-10-18", "suma"), falta("2026-10-25", "suma"), falta("2026-11-01", "suma")],
  }));
  expect(e.titulo).toBe("Alerta de retiro");
  expect(e.motivo).toBe("4 faltas sin justificar (18 oct, 25 oct, 1 nov, 8 nov)");
  expect(e.siguientePaso).toMatch(/No se retira de forma automática|no se retira de forma automática/);
});

test("RF-702: si llega a la alerta de retiro sin ficha firmada lo indica", () => {
  const e = explicarPaso(entrada({ paso: "alerta_retiro", conteo: 4, sinFicha: true, faltasOrigen: [falta("2026-11-08", "suma")] }));
  expect(e.motivo).toContain("y sin ficha de compromiso firmada");
});

test("RF-702: la citación explica que son 3 faltas y que falta la ficha de compromiso", () => {
  const e = explicarPaso(entrada({ paso: "citacion", conteo: 3, sinFicha: true, faltasOrigen: [falta("2026-10-25", "suma"), falta("2026-11-01", "suma"), falta("2026-11-08", "suma")] }));
  expect(e.titulo).toBe("Citación");
  expect(e.motivo).toBe("3 faltas (25 oct, 1 nov, 8 nov) y sin ficha de compromiso firmada");
  expect(e.siguientePaso).toBe("Citar al apoderado y firmar la ficha de compromiso (coordinación).");
});

test("RF-702: el seguimiento indica que la ficha ya está firmada", () => {
  const e = explicarPaso(entrada({ paso: "seguimiento", conteo: 3, sinFicha: false, faltasOrigen: [falta("2026-11-01", "suma")] }));
  expect(e.motivo).toContain("con ficha de compromiso firmada");
});

test("RF-702: el contacto con 2 faltas pide contactar al apoderado", () => {
  const e = explicarPaso(entrada({ paso: "contacto", conteo: 2, faltasOrigen: [falta("2026-11-01", "suma"), falta("2026-11-08", "suma")] }));
  expect(e.motivo).toBe("2 faltas sin justificar (1 nov, 8 nov)");
  expect(e.siguientePaso).toBe("Contactar al apoderado (catequista del grupo y coordinación).");
});

test("RF-701: una falta pendiente de justificar se explica como que aún no suma", () => {
  const e = explicarPaso(entrada({ conteo: 2, faltasOrigen: [falta("2026-10-25", "suma"), falta("2026-11-01", "suma"), falta("2026-11-08", "pendiente_justificar")], pendientesJustificar: 1 }));
  expect(e.pendientes).toBe("1 falta pendiente de justificar: aún no suma");
  expect(e.motivo).not.toContain("8 nov");
});

test("RF-701: una justificación en revisión no suma hasta que se decida", () => {
  const e = explicarPaso(entrada({ faltasOrigen: [falta("2026-11-08", "en_revision"), falta("2026-11-01", "suma"), falta("2026-10-25", "suma")] }));
  expect(e.pendientes).toBe("1 falta con la justificación en revisión: no suma hasta que se decida");
});

test("RF-708: el saldo cargado desde papel se cuenta sin inventar fechas", () => {
  const e = explicarPaso(entrada({ conteo: 3, faltasOrigen: [falta("2026-10-01", "suma", "papel", 2), falta("2026-11-08", "suma")] }));
  expect(e.motivo).toContain("8 nov, 2 faltas del saldo cargado desde papel");
});

test("RF-707: una justificación aprobada no aparece entre las faltas que suman", () => {
  const e = explicarPaso(entrada({ conteo: 2, faltasOrigen: [falta("2026-11-08", "justificada"), falta("2026-11-01", "suma"), falta("2026-10-25", "suma")] }));
  expect(e.motivo).toBe("2 faltas sin justificar (25 oct, 1 nov)");
});

test("RF-702: los pasos tienen un título en español", () => {
  expect(tituloDePaso("alerta_retiro")).toBe("Alerta de retiro");
  expect(tituloDePaso("citacion")).toBe("Citación");
  expect(tituloDePaso("sin_riesgo")).toBe("Sin riesgo");
});
