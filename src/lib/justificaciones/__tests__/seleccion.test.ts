import type { AusenciaJustificable } from "../cliente-justificaciones";
import { agruparPorNino, alternarSeleccion, claveAusencia, fechaCorta, puedeEnviar, seleccionadas } from "../seleccion";

const ausencia = (nino: string, nombre: string, sesion: string, fecha: string, tipo: "misa" | "catequesis" = "misa"): AusenciaJustificable => ({
  catequizandoId: nino, nombre, sesionId: sesion, tipoSesion: tipo, fecha, venceEn: "2026-11-15T23:59:59-05:00",
});
const A = ausencia("n1", "Ana", "s1", "2026-11-08");
const B = ausencia("n1", "Ana", "s2", "2026-11-08", "catequesis");
const C = ausencia("n2", "Beto", "s1", "2026-11-01");

test("RF-401: alternar agrega y quita una ausencia sin mutar la selección anterior", () => {
  const vacia = new Set<string>();
  const una = alternarSeleccion(vacia, claveAusencia(A));
  expect([...vacia]).toEqual([]);
  expect(una.has(claveAusencia(A))).toBe(true);
  expect(alternarSeleccion(una, claveAusencia(A)).size).toBe(0);
});

test("RF-401: se pueden justificar varias ausencias de uno o varios hijos a la vez", () => {
  const seleccion = new Set([claveAusencia(A), claveAusencia(B), claveAusencia(C)]);
  expect(seleccionadas([A, B, C], seleccion)).toHaveLength(3);
});

test("RF-405: una ausencia seleccionada que el servidor ya no ofrece se descarta", () => {
  const seleccion = new Set([claveAusencia(A), claveAusencia(C)]);
  expect(seleccionadas([A, B], seleccion)).toEqual([A]);
});

test("RF-401: agrupa por niño y ordena por nombre y fecha", () => {
  const filas = agruparPorNino([C, B, A]);
  expect(filas.map((f) => f.nombre)).toEqual(["Ana", "Beto"]);
  expect(filas[0].ausencias.map((a) => a.tipoSesion)).toEqual(["catequesis", "misa"]);
});

test("RF-402: enviar exige al menos una ausencia, una causa y una foto", () => {
  expect(puedeEnviar({ cantidadAusencias: 1, tieneCausa: true, tieneFoto: true })).toBe(true);
  expect(puedeEnviar({ cantidadAusencias: 0, tieneCausa: true, tieneFoto: true })).toBe(false);
  expect(puedeEnviar({ cantidadAusencias: 1, tieneCausa: false, tieneFoto: true })).toBe(false);
  expect(puedeEnviar({ cantidadAusencias: 1, tieneCausa: true, tieneFoto: false })).toBe(false);
});

test("RF-401: la fecha civil se muestra sin correrla de día", () => {
  expect(fechaCorta("2026-11-08")).toBe("8 nov");
  expect(fechaCorta("2026-01-01")).toBe("1 ene");
  expect(fechaCorta("no-es-fecha")).toBe("no-es-fecha");
});
