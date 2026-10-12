import type { Rol } from "./contexto-acceso";
export { ROLES, type Rol } from "./contexto-acceso";
export const esRolEquipo = (rol: Rol): boolean => rol !== "familia";
