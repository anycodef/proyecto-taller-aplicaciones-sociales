import { ROLES } from "@/lib/seguridad/roles";

test("infra: jest-expo resuelve el alias @/", () => {
  expect(ROLES).toEqual(["administracion", "coordinacion", "catequista", "familia", "supervision"]);
});
