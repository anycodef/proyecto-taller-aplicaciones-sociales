import type { DatosNino } from "./contratos";
import type { Grupo } from "./modelo";
import { edadEnFecha } from "./edad";
import { sugerirGrupos } from "./grupos";
export const CAMPOS_CORREGIBLES = ["nombres", "apellidos", "fechaNacimiento", "sexo", "bautizado"] as const;
export function diferenciasCorregibles(anterior: DatosNino, nuevo: Partial<DatosNino>) {
  return CAMPOS_CORREGIBLES.filter(campo => nuevo[campo] !== undefined && nuevo[campo] !== anterior[campo]).map(campo => ({ campo, valorAnterior: anterior[campo], valorNuevo: nuevo[campo] }));
}
export function cambiaGrupoSugerido(grupos: Grupo[], anterior: DatosNino, nuevo: DatosNino, grupoActualId: string, inicioCiclo: string): boolean {
  const antes = sugerirGrupos(edadEnFecha(anterior.fechaNacimiento, inicioCiclo), anterior.sexo, grupos).map(g => g.id);
  const despues = sugerirGrupos(edadEnFecha(nuevo.fechaNacimiento, inicioCiclo), nuevo.sexo, grupos).map(g => g.id);
  return antes.includes(grupoActualId) !== despues.includes(grupoActualId) || antes.join() !== despues.join();
}
