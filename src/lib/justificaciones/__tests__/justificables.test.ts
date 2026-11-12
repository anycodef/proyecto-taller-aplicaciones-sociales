import { agruparPorDomingo, ausenciasJustificables, sesionesAnticipables, type SesionFutura } from "@/lib/justificaciones/justificables";
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

test("RF-401: misa y catequesis del mismo domingo se muestran en una fila", () => {
  const hermano: AusenciaRef = { ...misa, catequizandoId: "nino-2" };
  const filas = agruparPorDomingo([actividad, catequesis, hermano, misa]);
  expect(filas).toEqual([
    { catequizandoId: "nino-1", fecha: "2026-11-01", ausencias: [catequesis, misa] },
    { catequizandoId: "nino-2", fecha: "2026-11-01", ausencias: [hermano] },
    { catequizandoId: "nino-1", fecha: "2026-11-03", ausencias: [actividad] },
  ]);
});

const futura = (id: string, fecha: string, parcial: Partial<SesionFutura> = {}): SesionFutura => ({ id, cicloId: "ciclo-1", fecha, tipo: "misa", cancelada: false, ...parcial });

test("RF-404: ofrece las sesiones futuras del ciclo que no tienen justificación", () => {
  const sesiones = [futura("misa-1108", "2026-11-08"), futura("misa-1115", "2026-11-15"), futura("misa-1122", "2026-11-22", { cancelada: true })];
  const yaAnticipada = justificacion({ sesionId: "misa-1115", fecha: "2026-11-15", causa: "evento_escolar", anticipada: true });
  expect(sesionesAnticipables({ sesiones, catequizandoIds: ["nino-1", "nino-2"], justificaciones: [yaAnticipada], cicloId: "ciclo-1", ahora })).toEqual([
    { catequizandoId: "nino-1", sesionId: "misa-1108", tipoSesion: "misa", fecha: "2026-11-08" },
    { catequizandoId: "nino-2", sesionId: "misa-1108", tipoSesion: "misa", fecha: "2026-11-08" },
    { catequizandoId: "nino-2", sesionId: "misa-1115", tipoSesion: "misa", fecha: "2026-11-15" },
  ]);
});

test("RF-404: no ofrece como anticipables sesiones pasadas ni de otro ciclo", () => {
  const sesiones = [futura("misa-0101", "2026-11-01"), futura("hoy", "2026-11-04"), futura("otro", "2026-11-08", { cicloId: "ciclo-2" })];
  expect(sesionesAnticipables({ sesiones, catequizandoIds: ["nino-1"], justificaciones: [], cicloId: "ciclo-1", ahora })).toEqual([]);
});
