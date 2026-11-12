import { puedeJustificar, puedeRegistrarEnNombre, puedeRevisar } from "@/lib/justificaciones/permisos";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";

const ahora = new Date("2026-11-04T15:00:00Z");

function contexto(roles: Rol[], parcial: Partial<ContextoAcceso> = {}): ContextoAcceso {
  return { cuentaId: "cuenta-1", credencialId: "cred-1", rolesPropios: roles, gruposAsignados: [], catequizandosApoderados: [], identidadOperativa: "Catequista 1", esMenor: false, ...parcial };
}

test("RF-408: solo la coordinación o un delegado vigente puede revisar", () => {
  expect(puedeRevisar(contexto(["coordinacion"]), ahora)).toBe(true);
  expect(puedeRevisar(contexto(["catequista"], { delegacionVigente: { id: "d-1", hasta: "2026-11-30T23:59:59-05:00" } }), ahora)).toBe(true);
  expect(puedeRevisar(contexto(["catequista"]), ahora)).toBe(false);
  expect(puedeRevisar(contexto(["familia"]), ahora)).toBe(false);
  expect(puedeRevisar(contexto(["administracion"]), ahora)).toBe(false);
});

test("RF-408: supervisión no puede revisar", () => {
  expect(puedeRevisar(contexto(["supervision"]), ahora)).toBe(false);
});

test("RF-408: un delegado con la delegación vencida no puede revisar", () => {
  const vencida = contexto(["catequista"], { delegacionVigente: { id: "d-1", hasta: "2026-11-04T09:59:59-05:00" } });
  expect(puedeRevisar(vencida, ahora)).toBe(false);
  expect(puedeRegistrarEnNombre(vencida, ahora)).toBe(false);
});

test("RF-406: solo la coordinación o un delegado registra en nombre de un apoderado", () => {
  expect(puedeRegistrarEnNombre(contexto(["coordinacion"]), ahora)).toBe(true);
  expect(puedeRegistrarEnNombre(contexto(["catequista"], { delegacionVigente: { id: "d-1", hasta: "2026-11-30T23:59:59-05:00" } }), ahora)).toBe(true);
  expect(puedeRegistrarEnNombre(contexto(["catequista"]), ahora)).toBe(false);
  expect(puedeRegistrarEnNombre(contexto(["supervision"]), ahora)).toBe(false);
  expect(puedeRegistrarEnNombre(contexto(["familia"]), ahora)).toBe(false);
});

test("RF-401: un apoderado solo justifica a sus hijos", () => {
  const familia = contexto(["familia"], { catequizandosApoderados: ["nino-1", "nino-2"] });
  expect(puedeJustificar(familia, "nino-1")).toBe(true);
  expect(puedeJustificar(familia, "nino-9")).toBe(false);
  expect(puedeJustificar(contexto(["coordinacion"], { catequizandosApoderados: ["nino-1"] }), "nino-1")).toBe(false);
});
