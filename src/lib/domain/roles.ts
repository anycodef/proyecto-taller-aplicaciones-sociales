/**
 * Control de acceso en tres niveles (Fase 2 - Propuesta arquitectonica).
 *
 * Los permisos se definen a nivel de dato y no unicamente de pantalla:
 * cada catequista accede solo a los registros de su grupo y cada familia
 * unicamente al perfil de su propio hijo.
 */
export const ROLES = ["admin", "catequista", "familia"] as const;

export type Rol = (typeof ROLES)[number];

export type SesionUsuario = {
  usuarioId: string;
  rol: Rol;
  /** Grupos que el catequista tiene a cargo. Vacio para admin y familia. */
  gruposACargo: string[];
  /** Catequizandos vinculados a la familia. Vacio para admin y catequista. */
  catequizandosACargo: string[];
};

/** Un admin ve todo; los demas roles quedan acotados por su alcance. */
export function puedeVerGrupo(sesion: SesionUsuario, grupoId: string): boolean {
  if (sesion.rol === "admin") return true;
  if (sesion.rol === "catequista") return sesion.gruposACargo.includes(grupoId);
  return false;
}

export function puedeVerCatequizando(
  sesion: SesionUsuario,
  catequizando: { id: string; grupoId: string },
): boolean {
  if (sesion.rol === "admin") return true;
  if (sesion.rol === "catequista") {
    return sesion.gruposACargo.includes(catequizando.grupoId);
  }
  return sesion.catequizandosACargo.includes(catequizando.id);
}

/** Solo quien tiene el grupo a cargo (o administracion) registra asistencia. */
export function puedeRegistrarAsistencia(
  sesion: SesionUsuario,
  grupoId: string,
): boolean {
  return sesion.rol === "admin" || sesion.gruposACargo.includes(grupoId);
}
