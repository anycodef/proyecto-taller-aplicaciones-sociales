import type { AlmacenEvidencias } from "../dominio/puertos";
import { configAlmacenDesdeEntorno, crearAlmacenEvidencias } from "./almacen-evidencias-blob";

let almacen: AlmacenEvidencias | undefined;

/** Se crea al primer uso: el arranque de Functions no debe leer configuración de Blob. */
export function obtenerAlmacenEvidencias(): AlmacenEvidencias {
  almacen ??= crearAlmacenEvidencias(configAlmacenDesdeEntorno());
  return almacen;
}

export function configurarAlmacenEvidencias(puerto: AlmacenEvidencias | undefined): void {
  almacen = puerto;
}
