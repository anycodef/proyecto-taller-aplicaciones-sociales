import type { BorradorLista } from "@/lib/asistencia/lista";
import {
  guardarCorreccion,
  guardarLista,
  guardarMarca,
  type FilaCorreccion,
  type FilaMarca,
} from "@/lib/asistencia/pendientes";
import type { ConfirmarListaLocal, RepositorioAsistencia } from "@/lib/asistencia/repositorio-asistencia";
import { aSesion } from "@/lib/asistencia/sesiones";
import type { NinoNomina } from "@/lib/asistencia/tipos";
import { filasDe, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";

export type AlmacenLocalDisco = {
  leer(): AlmacenLocal;
  guardar(estado: AlmacenLocal): void;
  borrar(): void;
};

/**
 * Repositorio local con su estado propio. Es un almacen externo: quien lo
 * usa se suscribe y recibe el estado vigente. La base de datos que lo respalde
 * puede cambiar (WatermelonDB, expo-sqlite o el archivo actual) sin que el
 * dominio se entere, porque el contrato es este y no el almacenamiento.
 */
export type RepositorioLocal = RepositorioAsistencia & {
  /** Estado vigente del almacen. */
  estado(): AlmacenLocal;
  /** Avisa a los oyentes cuando el estado cambia. */
  suscribir(oyente: () => void): () => void;
  /** Reemplaza el estado y lo persiste. */
  escribir(estado: AlmacenLocal): void;
};

/** Tabla local, nunca sincronizada: el borrador de la lista en el celular. */
const COLECCION_BORRADORES = "borradores_lista";

export function crearRepositorioLocal(disco: AlmacenLocalDisco): RepositorioLocal {
  let vigente: AlmacenLocal | null = null;
  const oyentes = new Set<() => void>();

  const leer = (): AlmacenLocal => {
    if (!vigente) vigente = disco.leer();
    return vigente;
  };

  const escribir = (estado: AlmacenLocal): void => {
    vigente = estado;
    disco.guardar(estado);
    oyentes.forEach((notificar) => notificar());
  };

  const ninosDeGrupos = (grupoIds: string[]): NinoNomina[] => {
    const grupos = new Set(grupoIds);
    return filasDe(leer(), "catequizandos")
      .filter((fila) => grupos.has(String(fila.grupo_id)) && fila.activo !== false)
      .map((fila) => ({
        id: String(fila.id),
        nombres: String(fila.nombres),
        apellidos: String(fila.apellidos),
        grupoId: String(fila.grupo_id),
        codigoCarne: fila.codigo_carne ? String(fila.codigo_carne) : null,
        activo: fila.activo !== false,
      }));
  };

  return {
    estado: leer,

    suscribir(oyente: () => void): () => void {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },

    escribir,

    ninosActivos(grupoId: string): NinoNomina[] {
      return ninosDeGrupos([grupoId]);
    },

    ninosDeGrupos,

    sesiones() {
      return filasDe(leer(), "sesiones").map((fila) => aSesion(fila));
    },

    leerBorrador(borradorId: string): BorradorLista | null {
      const fila = filasDe(leer(), COLECCION_BORRADORES).find(
        (guardada) => guardada.id === borradorId
      );
      if (!fila) return null;
      try {
        return JSON.parse(String(fila.valores)) as BorradorLista;
      } catch {
        return null;
      }
    },

    guardarBorrador(borradorId: string, borrador: BorradorLista): void {
      const estado = leer();
      const borradores = { ...(estado.colecciones[COLECCION_BORRADORES] ?? {}) };
      borradores[borradorId] = { id: borradorId, valores: JSON.stringify(borrador) };
      escribir({
        ...estado,
        colecciones: { ...estado.colecciones, [COLECCION_BORRADORES]: borradores },
      });
    },

    registrarMarca(marca: FilaMarca): void {
      const estado = leer();
      escribir({
        ...estado,
        pendientes: guardarMarca(estado.pendientes, { id: marca.id, fila: marca }),
      });
    },

    registrarCorreccion(correccion: FilaCorreccion): void {
      const estado = leer();
      escribir({
        ...estado,
        pendientes: guardarCorreccion(estado.pendientes, { id: correccion.id, fila: correccion }),
      });
    },

    confirmarLista(entrada: ConfirmarListaLocal): void {
      const estado = leer();
      const conLista = guardarLista(estado.pendientes, { id: entrada.lista.id, fila: entrada.lista });
      const conMarcas = entrada.marcas.reduce(
        (pendientes, marca) => guardarMarca(pendientes, { id: marca.id, fila: marca }),
        conLista
      );
      const borradores = { ...(estado.colecciones[COLECCION_BORRADORES] ?? {}) };
      delete borradores[entrada.borradorId];
      // Una sola escritura: la lista, sus marcas y el borrador cambian juntos.
      escribir({
        ...estado,
        colecciones: { ...estado.colecciones, [COLECCION_BORRADORES]: borradores },
        pendientes: conMarcas,
      });
    },
  };
}
