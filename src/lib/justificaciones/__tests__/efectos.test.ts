import { ausenciaMisaJustificada, estadoParaRiesgo, faltaJustificada, fechasJustificadas } from "@/lib/justificaciones/efectos";
import { justificacion } from "./fabrica";

const anulada = "2026-11-05T08:00:00-05:00";

test("RF-409: una aprobada de esa fecha deja la falta justificada", () => {
  const aprobadaCatequesis = justificacion({ sesionId: "cat-0101", tipoSesion: "catequesis", estadoRevision: "aprobada" });
  expect(faltaJustificada("2026-11-01", "nino-1", [aprobadaCatequesis])).toBe(true);
  expect(faltaJustificada("2026-11-01", "nino-2", [aprobadaCatequesis])).toBe(false);
  expect(fechasJustificadas([aprobadaCatequesis, { ...aprobadaCatequesis, id: "j-2", sesionId: "misa-0101" }])).toEqual([{ catequizandoId: "nino-1", fecha: "2026-11-01" }]);
});

test("RF-409: una pendiente, rechazada o sin efecto no justifica la falta", () => {
  const js = [
    justificacion(),
    justificacion({ id: "j-2", estadoRevision: "rechazada", motivoRechazo: "Foto ilegible" }),
    justificacion({ id: "j-3", estadoRevision: "aprobada", sinEfectoDesde: anulada }),
  ];
  expect(faltaJustificada("2026-11-01", "nino-1", js)).toBe(false);
  expect(fechasJustificadas(js)).toEqual([]);
});

test("RF-409: una ausencia a misa aprobada no cuenta en contra para la aptitud", () => {
  const aprobadaMisa = justificacion({ estadoRevision: "aprobada" });
  expect(ausenciaMisaJustificada("misa-0101", "nino-1", [aprobadaMisa])).toBe(true);
  expect(ausenciaMisaJustificada("misa-0101", "nino-1", [{ ...aprobadaMisa, sinEfectoDesde: anulada }])).toBe(false);
  expect(ausenciaMisaJustificada("cat-0101", "nino-1", [{ ...aprobadaMisa, sesionId: "cat-0101", tipoSesion: "catequesis" }])).toBe(false);
});

test("RF-409: estadoParaRiesgo devuelve aprobada, pendiente, rechazada o ninguna", () => {
  const ausencia = { catequizandoId: "nino-1", fecha: "2026-11-01" };
  const rechazada = justificacion({ id: "j-r", estadoRevision: "rechazada", motivoRechazo: "x" });
  const pendiente = justificacion({ id: "j-p" });
  const aprobada = justificacion({ id: "j-a", estadoRevision: "aprobada" });
  expect(estadoParaRiesgo(ausencia, [])).toBe("ninguna");
  expect(estadoParaRiesgo(ausencia, [rechazada])).toBe("rechazada");
  expect(estadoParaRiesgo(ausencia, [rechazada, pendiente])).toBe("pendiente");
  expect(estadoParaRiesgo(ausencia, [rechazada, pendiente, aprobada])).toBe("aprobada");
  expect(estadoParaRiesgo(ausencia, [{ ...aprobada, sinEfectoDesde: anulada }])).toBe("ninguna");
});
