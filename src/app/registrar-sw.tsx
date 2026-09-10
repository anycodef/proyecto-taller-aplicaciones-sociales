"use client";

import { useEffect } from "react";

/** Registra el service worker una vez que la pagina termino de cargar. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker la app sigue siendo usable, solo pierde el modo
      // sin conexion; no vale la pena interrumpir a la catequista por esto.
    });
  }, []);

  return null;
}
