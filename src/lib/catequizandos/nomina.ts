export type NinoNomina = { id: string; nombres: string; apellidos: string; grupo_id: string; activo?: boolean };
export type GrupoNomina = { id: string; nombre?: string; es_mio?: boolean };
export type GrupoConNinos = { id: string; nombre: string; esMio: boolean; ninos: NinoNomina[] };

const normalizar = (texto: string): string => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Agrupa la nómina local por grupo, con los grupos del catequista primero y los niños por nombre.
 * `busqueda` filtra por nombre o apellido sin distinguir tildes ni mayúsculas; un grupo sin coincidencias no se muestra.
 */
export function agruparNomina(grupos: readonly GrupoNomina[], ninos: readonly NinoNomina[], busqueda = ""): GrupoConNinos[] {
  const consulta = normalizar(busqueda);
  return grupos
    .map((grupo) => ({
      id: grupo.id,
      nombre: grupo.nombre ?? "Grupo",
      esMio: grupo.es_mio === true,
      ninos: ninos
        .filter((nino) => nino.grupo_id === grupo.id && nino.activo !== false)
        .filter((nino) => !consulta || normalizar(`${nino.nombres} ${nino.apellidos}`).includes(consulta))
        .sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`)),
    }))
    .filter((grupo) => grupo.ninos.length > 0)
    .sort((a, b) => Number(b.esMio) - Number(a.esMio) || a.nombre.localeCompare(b.nombre));
}
