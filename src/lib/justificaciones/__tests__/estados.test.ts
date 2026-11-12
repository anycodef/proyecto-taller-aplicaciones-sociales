import { estadoVisible, revisar } from "@/lib/justificaciones/estados";
import { justificacion } from "./fabrica";

const en = "2026-11-03T09:00:00-05:00";

test("RF-408: solo se revisa una justificación pendiente", () => {
  const aprobada = revisar(justificacion(), "aprobada", "coord-1", en);
  expect(() => revisar(aprobada, "rechazada", "coord-1", en, "Foto ilegible")).toThrow("no_pendiente");
  const rechazada = revisar(justificacion(), "rechazada", "coord-1", en, "Foto ilegible");
  expect(() => revisar(rechazada, "aprobada", "coord-1", en)).toThrow("no_pendiente");
  expect(() => revisar(justificacion({ sinEfectoDesde: en }), "aprobada", "coord-1", en)).toThrow("sin_efecto");
});

test("RF-408: rechazar sin motivo lanza error", () => {
  expect(() => revisar(justificacion(), "rechazada", "coord-1", en)).toThrow("motivo_requerido");
  expect(() => revisar(justificacion(), "rechazada", "coord-1", en, "   ")).toThrow("motivo_requerido");
  expect(() => revisar(justificacion(), "rechazada", "coord-1", en, "x".repeat(281))).toThrow("motivo_largo");
});

test("RF-408: la revisión registra quién y cuándo", () => {
  const rechazada = revisar(justificacion(), "rechazada", "coord-1", en, " Foto ilegible ");
  expect(rechazada).toMatchObject({ estadoRevision: "rechazada", revisadaPor: "coord-1", revisadaEn: en, motivoRechazo: "Foto ilegible" });
  const aprobada = revisar(justificacion(), "aprobada", "delegado-1", en, "ignorado");
  expect(aprobada).toMatchObject({ estadoRevision: "aprobada", revisadaPor: "delegado-1", revisadaEn: en, motivoRechazo: null });
});

test("RF-410: estadoVisible devuelve pendiente, aprobada, rechazada o sin_efecto", () => {
  expect(estadoVisible(justificacion())).toBe("pendiente");
  expect(estadoVisible(justificacion({ estadoRevision: "aprobada" }))).toBe("aprobada");
  expect(estadoVisible(justificacion({ estadoRevision: "rechazada", motivoRechazo: "x" }))).toBe("rechazada");
  expect(estadoVisible(justificacion({ estadoRevision: "aprobada", sinEfectoDesde: en }))).toBe("sin_efecto");
});
