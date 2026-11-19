import { useSyncExternalStore } from "react";

/**
 * Versión de la bandeja en memoria. Al volver del detalle con router.back() la
 * bandeja sigue montada con sus datos viejos: quien revisa o registra la marca
 * desactualizada y la bandeja vuelve a pedirse sola.
 */
let version = 0;
const oyentes = new Set<() => void>();

export function marcarBandejaDesactualizada(): void {
  version += 1;
  for (const oyente of oyentes) oyente();
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function useVersionBandeja(): number {
  return useSyncExternalStore(suscribir, () => version, () => version);
}
