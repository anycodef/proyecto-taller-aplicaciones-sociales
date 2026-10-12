import { rolesEfectivos, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";

test("RF-102: el cliente comparte roles y unión de alcances con el backend", () => {
  const contexto: ContextoAcceso = { cuentaId: "cuenta", credencialId: "credencial", rolesPropios: ["catequista", "familia"], gruposAsignados: [], catequizandosApoderados: [], identidadOperativa: "Luz", esMenor: true, delegacionVigente: { id: "delegacion", hasta: "2030-01-01T00:00:00Z" } };
  expect(rolesEfectivos(contexto)).toEqual(["catequista", "familia", "coordinacion"]);
});
