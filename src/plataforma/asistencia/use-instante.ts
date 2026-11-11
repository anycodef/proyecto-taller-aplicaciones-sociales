import { useSyncExternalStore } from "react";

/**
 * Instante actual del celular. Se lee con useSyncExternalStore y no durante el
 * render: leer el reloj mientras se dibuja produce dos instantes distintos en
 * la misma pasada. El valor se actualiza solo cada 30 segundos, que es lo que
 * necesita la pantalla de lista para saber el dia.
 */
const INTERVALO_MS = 30_000;

let cache = Date.now();
const oyentes = new Set<() => void>();

function leerInstante(): number {
  return cache;
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  const temporizador = setInterval(() => {
    cache = Date.now();
    oyentes.forEach((notificar) => notificar());
  }, INTERVALO_MS);
  return () => {
    clearInterval(temporizador);
    oyentes.delete(oyente);
  };
}

export function useInstante(): number {
  return useSyncExternalStore(suscribir, leerInstante, leerInstante);
}
