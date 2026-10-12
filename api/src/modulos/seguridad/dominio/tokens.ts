import { createHash, randomBytes, createHmac } from "node:crypto";
export const generarToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): Buffer => createHash("sha256").update(token, "utf8").digest();
// Derivar el sucesor permite devolverlo otra vez sin almacenar secretos recuperables en BD.
export function sucesorRenovacion(token: string): string {
  const clave = process.env.RENOVACION_CLAVE;
  if (!clave || Buffer.byteLength(clave) < 32) throw new Error("Falta RENOVACION_CLAVE (32 bytes minimo)");
  return createHmac("sha256", clave).update(`sigecat-renovacion-v1:${token}`).digest("base64url");
}
