// JWT de demostración HS256 con jose (spec 009, plan §5, RF-906).
// Clave local solo para la demo: DEMO_JWT_CLAVE.
// Rol: COORD, CAT, FAM, SUP. SUP nunca escribe. CAT solo su grupo.

import { SignJWT, jwtVerify } from 'jose';

const CLAVE = new TextEncoder().encode(process.env.DEMO_JWT_CLAVE ?? 'clave-demo-tarea3-no-usar-en-produccion');

export interface TokenPayload {
  rol: 'COORD' | 'CAT' | 'FAM' | 'SUP';
  grupoId?: string; // grupo del catequista/familiar (puede ser undefined para COORD/SUP)
  identidadOperativa: string;
  sub: string; // uuid del autor
}

export async function emitirToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(CLAVE);
}

export async function verificarToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, CLAVE);
  return payload as unknown as TokenPayload;
}

// Rol del autor puede leer datos del grupo indicado.
export function puedeLeerGrupo(rol: TokenPayload['rol'], grupoIdToken: string | undefined, grupoIdRecurso: string): boolean {
  if (rol === 'SUP') return true; // supervisión lee todo
  if (rol === 'COORD') return true; // coordinación lee todos los grupos
  if (rol === 'CAT') return grupoIdToken !== undefined && grupoIdToken === grupoIdRecurso;
  if (rol === 'FAM') return false; // FAM lee a su hijo, no a un grupo (se resuelve por catequizando)
  return false;
}

// Rol del autor puede escribir (alta/modificación de asistencia, justificación, riesgo).
export function puedeEscribir(rol: TokenPayload['rol']): boolean {
  return rol !== 'SUP'; // SUP nunca escribe (RF-906)
}
