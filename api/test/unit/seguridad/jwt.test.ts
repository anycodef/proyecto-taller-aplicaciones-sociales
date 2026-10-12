import { SignJWT, decodeJwt } from "jose";
import { firmarJwt, verificarJwt } from "../../../src/modulos/seguridad/infraestructura/firmador-jwt";
const identidad = { cuentaId: "10000000-0000-4000-8000-000000000001", credencialId: "10000000-0000-4000-8000-000000000002", dispositivoId: "10000000-0000-4000-8000-000000000003", tipo: "equipo" as const };
let anteriores: NodeJS.ProcessEnv;
beforeEach(() => { anteriores = { ...process.env }; process.env.JWT_CLAVES = JSON.stringify({ actual: "a".repeat(32), anterior: "b".repeat(32) }); process.env.JWT_KID = "actual"; });
afterEach(() => { process.env = anteriores; });
test("RF-101 RF-110: equipo 15 minutos, familia 30, sin roles ni identidad en JWT", async () => {
  const equipo = decodeJwt(await firmarJwt(identidad));
  const familia = decodeJwt(await firmarJwt({ cuentaId: identidad.cuentaId, credencialId: identidad.credencialId, tipo: "familia" }));
  expect(equipo.exp! - equipo.iat!).toBe(900);
  expect(familia.exp! - familia.iat!).toBe(1800);
  expect(equipo.roles).toBeUndefined();
  expect(equipo.identidadOperativa).toBeUndefined();
});
test("RF-101: firma, emisor, audiencia, vencimiento y kid se verifican", async () => {
  for (const caso of ["firma", "emisor", "audiencia", "vencimiento", "kid"]) {
    const token = await new SignJWT({ credencialId: identidad.credencialId, tipo: "equipo", dispositivoId: identidad.dispositivoId })
      .setProtectedHeader({ alg: "HS256", kid: caso === "kid" ? "desconocido" : "actual" }).setSubject(identidad.cuentaId).setIssuedAt()
      .setIssuer(caso === "emisor" ? "ajeno" : "sigecat").setAudience(caso === "audiencia" ? "ajeno" : "sigecat-api")
      .setExpirationTime(caso === "vencimiento" ? Math.floor(Date.now() / 1000) - 1 : "15m").sign(new TextEncoder().encode((caso === "firma" ? "z" : "a").repeat(32)));
    expect(await verificarJwt(token)).toBeNull();
  }
});
test("RF-101: rotación verifica kid anterior durante transición y lo revoca al retirarlo", async () => {
  process.env.JWT_KID = "anterior";
  const token = await firmarJwt(identidad);
  process.env.JWT_KID = "actual";
  expect(await verificarJwt(token)).toEqual(identidad);
  process.env.JWT_CLAVES = JSON.stringify({ actual: "a".repeat(32) });
  expect(await verificarJwt(token)).toBeNull();
});
