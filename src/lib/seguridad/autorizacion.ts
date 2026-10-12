import { rolesEfectivos, type ContextoAcceso, type RecursoAlcance } from "./contexto-acceso";
import { permisoPara, type Alcance } from "./matriz-permisos";
export type Decision = { permitido: true; alcance: Alcance } | { permitido: false; motivo: string };
export function autorizar(ctx: ContextoAcceso, accion: string, recurso?: RecursoAlcance): Decision {
  const permiso = permisoPara(accion);
  if (!permiso) return { permitido: false, motivo: "accion_desconocida" };
  const roles = permiso.propia ? ctx.rolesPropios : rolesEfectivos(ctx);
  for (const rol of roles) {
    const alcance = permiso.roles[rol];
    if (alcance === "ciclo") return { permitido: true, alcance };
    if (alcance === "grupos" && (!recurso || (recurso.grupoId && ctx.gruposAsignados.includes(recurso.grupoId)))) return { permitido: true, alcance };
    if (alcance === "apoderados" && (!recurso || (recurso.catequizandoId && ctx.catequizandosApoderados.includes(recurso.catequizandoId)))) return { permitido: true, alcance };
  }
  return { permitido: false, motivo: "fuera_de_alcance" };
}
