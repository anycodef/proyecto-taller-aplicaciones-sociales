import { autorizar } from "@/lib/seguridad/autorizacion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";

/** La delegación se revalida con `ahora`: el contexto pudo armarse antes de vencer. */
function coordinacionVigente(ctx: ContextoAcceso, ahora: Date): boolean {
  if (ctx.rolesPropios.includes("coordinacion")) return true;
  return !!ctx.delegacionVigente && ahora.getTime() < Date.parse(ctx.delegacionVigente.hasta);
}

export function puedeJustificar(ctx: ContextoAcceso, catequizandoId: string): boolean {
  return ctx.rolesPropios.includes("familia") && ctx.catequizandosApoderados.includes(catequizandoId);
}

export function puedeRegistrarEnNombre(ctx: ContextoAcceso, ahora: Date): boolean {
  return coordinacionVigente(ctx, ahora);
}

/** Supervisión consulta pero no revisa (RF-408). */
export function puedeRevisar(ctx: ContextoAcceso, ahora: Date): boolean {
  return coordinacionVigente(ctx, ahora);
}

export type NinoAlcance = { catequizandoId: string; grupoId: string };

/** Familia y catequistas del grupo ven el estado; supervisión y coordinación, todo el ciclo. */
export function puedeVerEstado(ctx: ContextoAcceso, nino: NinoAlcance): boolean {
  return autorizar(ctx, "justificacion:leer", nino).permitido;
}

/** La familia nunca ve la evidencia por la plataforma, ni la propia (RF-410, RNF-403). */
export function puedeVerEvidencia(ctx: ContextoAcceso, nino: NinoAlcance): boolean {
  return autorizar(ctx, "evidencia:leer", nino).permitido;
}
