import { createHash } from "node:crypto";
import { generarToken, hashToken, sucesorRenovacion } from "../../../src/modulos/seguridad/dominio/tokens";
import { validarDetalle } from "../../../src/modulos/seguridad/aplicacion/auditar";
import { comprobarRolesGestionables } from "../../../src/modulos/seguridad/aplicacion/cuentas";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
test("RF-110 RNF-104: tokens aleatorios de 256 bits y SHA-256 sin mensajería", () => {
  const token = generarToken();
  expect(Buffer.from(token, "base64url")).toHaveLength(32);
  expect(generarToken()).not.toBe(token);
  expect(hashToken(token)).toEqual(createHash("sha256").update(token).digest());
});
test("RF-112: sucesor recuperable para reintentar sin guardar token en claro", () => {
  const anterior = process.env.RENOVACION_CLAVE;
  process.env.RENOVACION_CLAVE = "r".repeat(32);
  try {
    const token = generarToken();
    expect(sucesorRenovacion(token)).toBe(sucesorRenovacion(token));
    expect(sucesorRenovacion(token)).not.toBe(token);
    expect(Buffer.from(sucesorRenovacion(token), "base64url")).toHaveLength(32);
  } finally { if (anterior === undefined) delete process.env.RENOVACION_CLAVE; else process.env.RENOVACION_CLAVE = anterior; }
});
test("RF-109 RNF-101: auditoría rechaza datos restringidos, objetos y texto libre", () => {
  expect(() => validarDetalle({ salud: "diagnostico" })).toThrow();
  expect(() => validarDetalle({ motivo: "nombre y diagnostico" })).toThrow();
  expect(() => validarDetalle({ motivo: "asma" })).toThrow();
  expect(() => validarDetalle({ cantidad: { nombre: "Ana" } })).toThrow();
  expect(() => validarDetalle({ cantidad: 3, roles: ["catequista"], motivo: "revocacion" })).not.toThrow();
});
test("RF-102 RNF-105: COORD gestiona CAT/FAM y rechaza cuentas multirol privilegiadas", () => {
  const ctx: ContextoAcceso = { cuentaId: "a", credencialId: "b", identidadOperativa: "c", esMenor: false, rolesPropios: ["coordinacion"], gruposAsignados: [], catequizandosApoderados: [] };
  expect(() => comprobarRolesGestionables(ctx, ["catequista", "familia"])).not.toThrow();
  expect(() => comprobarRolesGestionables(ctx, ["catequista", "supervision"])).toThrow("fuera_de_alcance");
  expect(() => comprobarRolesGestionables(ctx, ["administracion"])).toThrow();
});
