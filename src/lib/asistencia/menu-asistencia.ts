import type { FilaSincronizada } from "@/lib/sincronizacion/protocolo";
import { domingoDeReferencia } from "./reporte-misa";

export type GrupoLocal = { id: string; nombre: string; es_mio?: boolean };
export type GrupoParaLista = { id: string; nombre: string; esMio: boolean; ninos: number };

/**
 * Grupos para pasar lista: primero los propios y después todos, porque
 * cualquier catequista puede pasar la lista de un grupo ajeno (RF-306).
 */
export function gruposParaLista(grupos: GrupoLocal[], nomina: FilaSincronizada[]): GrupoParaLista[] {
  return grupos
    .map((grupo) => ({
      id: grupo.id,
      nombre: grupo.nombre,
      esMio: grupo.es_mio === true,
      ninos: nomina.filter((fila) => fila.grupo_id === grupo.id && fila.activo !== false).length,
    }))
    .sort((a, b) => Number(b.esMio) - Number(a.esMio) || a.nombre.localeCompare(b.nombre, "es"));
}

/** Fecha del reporte de misa que abre el menú: el domingo de hoy o el anterior. */
export const reporteDeDomingo = (fechaLima: string): string => domingoDeReferencia(fechaLima);
