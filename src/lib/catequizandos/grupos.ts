import type { Grupo, Sexo } from "./modelo";
export const modalidadHabitual = (edad: number, sexo: Sexo): "mixto" | Sexo => edad <= 10 ? "mixto" : sexo;
export function sugerirGrupos(edad: number, sexo: Sexo, grupos: Grupo[]): Grupo[] {
  return grupos.filter(g => g.estado === "abierto" && g.edadMinima <= edad && edad <= g.edadMaxima && g.modalidad === modalidadHabitual(edad, sexo)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id));
}
export const puedeCerrarGrupo = (cantidadActivos: number): boolean => cantidadActivos === 0;
export const gruposSinCatequista = (grupos: Grupo[], asignaciones: { grupoId: string; hasta?: string | null }[]): Grupo[] => grupos.filter(g => g.estado === "abierto" && !asignaciones.some(a => a.grupoId === g.id && !a.hasta));
