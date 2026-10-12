import type { ContextoAcceso } from "./contexto-acceso";
export type Delegacion = { id: string; delegadoId: string; deleganteId: string; desde: string; hasta: string; revocadaEn?: string | null };
export function delegacionVigente(delegaciones: Delegacion[], ahora: Date): Delegacion | undefined {
  return delegaciones.find(d => !d.revocadaEn && Date.parse(d.desde) <= ahora.getTime() && ahora.getTime() < Date.parse(d.hasta));
}
export function validarNuevaDelegacion(datos: { delegadoId: string; desde: string; hasta: string }, ctx: ContextoAcceso): boolean {
  return (ctx.rolesPropios.includes("administracion") || ctx.rolesPropios.includes("coordinacion")) && datos.delegadoId !== ctx.cuentaId && Date.parse(datos.hasta) > Date.parse(datos.desde);
}
