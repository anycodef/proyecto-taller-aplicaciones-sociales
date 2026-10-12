export const ROLES = ["administracion", "coordinacion", "catequista", "familia", "supervision"] as const;
export type Rol = (typeof ROLES)[number];
export type ContextoAcceso = {
  cuentaId: string;
  credencialId: string;
  dispositivoId?: string;
  rolesPropios: Rol[];
  delegacionVigente?: { id: string; hasta: string };
  gruposAsignados: string[];
  catequizandosApoderados: string[];
  identidadOperativa: string;
  esMenor: boolean;
};
export type RecursoAlcance = { grupoId?: string; catequizandoId?: string };
export function rolesEfectivos(contexto: ContextoAcceso): Rol[] {
  return [...new Set([...contexto.rolesPropios, ...(contexto.delegacionVigente ? ["coordinacion" as const] : [])])];
}
