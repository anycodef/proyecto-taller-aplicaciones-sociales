import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { confirmarLista as construirLista, type BorradorLista } from "./lista";
import {
  idListaAsistencia,
  listaALocal,
  marcaALocal,
  type FilaLista,
  type FilaMarca,
} from "./pendientes";
import { idBorradorLista, type RepositorioAsistencia } from "./repositorio-asistencia";
import type { Sesion } from "./tipos";

export type EntradaConfirmarLista = {
  repositorio: RepositorioAsistencia;
  cuenta: ContextoAcceso;
  sesion: Sesion;
  grupoId: string;
  borrador: BorradorLista;
  /** Instante en que se abrio la lista. */
  abiertaEn: string;
  /** Instante en que se confirmo. */
  hora: string;
  desfaseRelojMs: number;
};

export type ResultadoConfirmarLista = {
  lista: FilaLista;
  marcas: FilaMarca[];
};

/**
 * Confirma la lista de un grupo en el dispositivo. La lista y sus marcas se
 * crean con id determinista y en una sola transaccion, y el borrador se
 * borra con ellas: confirmar dos veces la misma lista no deja marcas nuevas
 * (RF-306, RF-307).
 */
export function confirmarListaEnLocal(entrada: EntradaConfirmarLista): ResultadoConfirmarLista {
  const { repositorio, cuenta, sesion, grupoId, borrador } = entrada;
  if (!cuenta.dispositivoId) throw new Error("El dispositivo no esta identificado");

  const { lista, marcas } = construirLista({
    borrador,
    cuenta,
    sesion,
    grupoId,
    id: idListaAsistencia(sesion.id, grupoId),
    abiertaEn: entrada.abiertaEn,
    hora: entrada.hora,
    desfaseRelojMs: entrada.desfaseRelojMs,
  });

  const resultado: ResultadoConfirmarLista = {
    lista: listaALocal(lista),
    marcas: marcas.map(marcaALocal),
  };

  repositorio.confirmarLista({
    ...resultado,
    borradorId: idBorradorLista(sesion.id, grupoId),
  });

  return resultado;
}
