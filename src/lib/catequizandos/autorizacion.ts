import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
export const puedeGestionarInscripciones = (sesion: ContextoAcceso): boolean => sesion.rolesPropios.includes("coordinacion") || Boolean(sesion.delegacionVigente);
export const puedeVerCondiciones = (sesion: ContextoAcceso, grupoId?: string): boolean => puedeGestionarInscripciones(sesion) || (sesion.rolesPropios.includes("catequista") && Boolean(grupoId && sesion.gruposAsignados.includes(grupoId)));
export function camposDePerfilVisibles(sesion: ContextoAcceso, nino: { id: string; grupoId?: string }): string[] {
  if (puedeVerCondiciones(sesion, nino.grupoId)) return ["nombre", "edad", "grupo", "apoderados", "documentos", "historialGrupos", "resumenes"];
  return sesion.rolesPropios.includes("familia") && sesion.catequizandosApoderados.includes(nino.id) ? ["nombre", "edad", "grupo", "documentos", "resumenes"] : [];
}
