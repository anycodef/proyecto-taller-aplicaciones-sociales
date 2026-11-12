import { ausenciasJustificables } from "@/lib/justificaciones/justificables";
import type { AusenciaRef } from "@/lib/justificaciones/tipos";
import { justificacion } from "./fabrica";

const ahora = new Date("2026-11-04T15:00:00Z");
const misa: AusenciaRef = { catequizandoId: "nino-1", sesionId: "misa-0101", tipoSesion: "misa", fecha: "2026-11-01" };
const catequesis: AusenciaRef = { catequizandoId: "nino-1", sesionId: "cat-0101", tipoSesion: "catequesis", fecha: "2026-11-01" };
const actividad: AusenciaRef = { catequizandoId: "nino-1", sesionId: "act-0103", tipoSesion: "actividad", fecha: "2026-11-03" };

test("RF-401: misa, catequesis y actividad obligatoria son justificables", () => {
  expect(ausenciasJustificables([misa, catequesis, actividad], [], 7, ahora)).toEqual([misa, catequesis, actividad]);
});

test("RF-405: una ausencia con plazo vencido ya no es justificable", () => {
  const antigua: AusenciaRef = { ...misa, sesionId: "misa-1025", fecha: "2026-10-25" };
  expect(ausenciasJustificables([antigua, misa], [], 7, ahora)).toEqual([misa]);
});

test("RF-401: no ofrece una ausencia con justificación pendiente o aprobada", () => {
  const pendiente = justificacion({ sesionId: misa.sesionId });
  const aprobada = justificacion({ id: "j-2", sesionId: catequesis.sesionId, estadoRevision: "aprobada" });
  expect(ausenciasJustificables([misa, catequesis, actividad], [pendiente, aprobada], 7, ahora)).toEqual([actividad]);
});

test("RF-408: una rechazada con plazo vigente vuelve a ofrecerse", () => {
  const rechazada = justificacion({ sesionId: misa.sesionId, estadoRevision: "rechazada", motivoRechazo: "Foto ilegible" });
  expect(ausenciasJustificables([misa], [rechazada], 7, ahora)).toEqual([misa]);
  expect(ausenciasJustificables([misa], [rechazada], 7, new Date("2026-11-09T06:00:00Z"))).toEqual([]);
});
