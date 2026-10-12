import { SignJWT, jwtVerify } from "jose";
export type IdentidadJwt = { cuentaId: string; credencialId: string; tipo: "equipo" | "familia"; dispositivoId?: string };
function claves(): { actual: string; claves: Record<string, Uint8Array> } {
  const actual = process.env.JWT_KID ?? "v1";
  const entradas: Record<string, string> = process.env.JWT_CLAVES ? JSON.parse(process.env.JWT_CLAVES) as Record<string, string> : { [actual]: process.env.JWT_CLAVE ?? "" };
  const resultado: Record<string, Uint8Array> = {};
  for (const [kid, clave] of Object.entries(entradas)) {
    if (typeof clave !== "string" || Buffer.byteLength(clave) < 32) throw new Error("JWT_CLAVES requiere claves de 32 bytes minimo");
    resultado[kid] = new TextEncoder().encode(clave);
  }
  if (!resultado[actual]) throw new Error("JWT_KID no esta en JWT_CLAVES");
  return { actual, claves: resultado };
}
export async function firmarJwt(datos: IdentidadJwt): Promise<string> {
  const config = claves();
  return new SignJWT({ credencialId: datos.credencialId, tipo: datos.tipo, ...(datos.dispositivoId ? { dispositivoId: datos.dispositivoId } : {}) })
    .setProtectedHeader({ alg: "HS256", kid: config.actual, typ: "JWT" }).setSubject(datos.cuentaId)
    .setIssuer("sigecat").setAudience("sigecat-api").setIssuedAt().setExpirationTime(datos.tipo === "equipo" ? "15m" : "30m").sign(config.claves[config.actual]!);
}
export async function verificarJwt(token: string): Promise<IdentidadJwt | null> {
  const config = claves();
  try {
    const { payload } = await jwtVerify(token, encabezado => {
      if (encabezado.alg !== "HS256" || !encabezado.kid || !config.claves[encabezado.kid]) throw new Error("clave_desconocida");
      return config.claves[encabezado.kid]!;
    }, { algorithms: ["HS256"], issuer: "sigecat", audience: "sigecat-api", requiredClaims: ["exp", "iat", "sub"] });
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!payload.sub || payload.sub.length !== 36 || !uuid.test(payload.sub) || typeof payload.credencialId !== "string" || payload.credencialId.length !== 36 || !uuid.test(payload.credencialId) || (payload.tipo !== "equipo" && payload.tipo !== "familia")) return null;
    if (payload.tipo === "equipo" && (typeof payload.dispositivoId !== "string" || payload.dispositivoId.length !== 36 || !uuid.test(payload.dispositivoId))) return null;
    return { cuentaId: payload.sub, credencialId: payload.credencialId, tipo: payload.tipo, ...(typeof payload.dispositivoId === "string" ? { dispositivoId: payload.dispositivoId } : {}) };
  } catch { return null; }
}
