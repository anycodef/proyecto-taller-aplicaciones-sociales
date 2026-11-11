import type { BorradorLista } from "./lista";
import type { FilaLista, FilaMarca } from "./pendientes";
import type { NinoNomina, Sesion } from "./tipos";

/** Identificador del borrador de una lista: la sesion y el grupo. */
export function idBorradorLista(sesionId: string, grupoId: string): string {
  return `${sesionId}:${grupoId}`;
}

export type ConfirmarListaLocal = {
  lista: FilaLista;
  marcas: FilaMarca[];
  /** Borrador que se borra al confirmar la lista. */
  borradorId: string;
};

/**
 * Repositorio de la asistencia en el dispositivo. Las pantallas y el dominio
 * hablan con esta interfaz y no con el almacen concreto: mientras la prueba
 * tecnica no decida la base local, el adaptador guarda en un archivo, pero las
 * reglas no dependen de esa eleccion.
 */
export interface RepositorioAsistencia {
  /** Ninos activos del grupo, de la nomina ya descargada. */
  ninosActivos(grupoId: string): NinoNomina[];
  /** Ninos activos de varios grupos, de la nomina ya descargada. */
  ninosDeGrupos(grupoIds: string[]): NinoNomina[];
  /** Sesiones que el dispositivo conoce. */
  sesiones(): Sesion[];
  /** Borrador guardado de la lista, si todavia no se confirmo. */
  leerBorrador(borradorId: string): BorradorLista | null;
  /** Guarda el borrador: cada toque queda en el dispositivo. */
  guardarBorrador(borradorId: string, borrador: BorradorLista): void;
  /** Guarda una marca suelta, de escaneo o de registro manual, para enviarla. */
  registrarMarca(marca: FilaMarca): void;
  /**
   * Crea la lista y sus marcas y borra el borrador en una sola transaccion:
   * si algo falla, el dispositivo queda como estaba.
   */
  confirmarLista(entrada: ConfirmarListaLocal): void;
}
