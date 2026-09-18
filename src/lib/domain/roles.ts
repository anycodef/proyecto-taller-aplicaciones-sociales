/**
 * Control de acceso basado en roles (Fase 2 - Seguridad y proteccion de datos).
 *
 * Cuatro roles: administracion, coordinacion, catequista y familia. Los
 * permisos se definen a nivel de dato y no unicamente de pantalla: cada
 * catequista accede solo a los registros de su grupo y cada familia
 * unicamente al perfil de su propio hijo.
 */
export const ROLES = ["admin", "coordinacion", "catequista", "familia"] as const;

export type Rol = (typeof ROLES)[number];

export type SesionUsuario = {
  usuarioId: string;
  rol: Rol;
  /** Grupos que el catequista tiene a cargo. Vacio para los demas roles. */
  gruposACargo: string[];
  /** Catequizandos vinculados a la familia. Vacio para los demas roles. */
  catequizandosACargo: string[];
};

/** Administracion y coordinacion ven el ciclo completo. */
function veTodoElCiclo(sesion: SesionUsuario): boolean {
  return sesion.rol === "admin" || sesion.rol === "coordinacion";
}

export function puedeVerGrupo(sesion: SesionUsuario, grupoId: string): boolean {
  if (veTodoElCiclo(sesion)) return true;
  if (sesion.rol === "catequista") return sesion.gruposACargo.includes(grupoId);
  return false;
}

export function puedeVerCatequizando(
  sesion: SesionUsuario,
  catequizando: { id: string; grupoId: string },
): boolean {
  if (veTodoElCiclo(sesion)) return true;
  if (sesion.rol === "catequista") {
    return sesion.gruposACargo.includes(catequizando.grupoId);
  }
  return sesion.catequizandosACargo.includes(catequizando.id);
}

/**
 * Salud y neurodivergencia son categoria de acceso restringido: solo la
 * coordinacion y el catequista responsable del grupo. Ni administracion ni
 * la propia familia las consultan por esta via.
 */
export function puedeVerDatosRestringidos(
  sesion: SesionUsuario,
  catequizando: { grupoId: string },
): boolean {
  if (sesion.rol === "coordinacion") return true;
  if (sesion.rol === "catequista") {
    return sesion.gruposACargo.includes(catequizando.grupoId);
  }
  return false;
}

/** Solo quien tiene el grupo a cargo, o la coordinacion, registra asistencia. */
export function puedeRegistrarAsistencia(
  sesion: SesionUsuario,
  grupoId: string,
): boolean {
  return veTodoElCiclo(sesion) || sesion.gruposACargo.includes(grupoId);
}
