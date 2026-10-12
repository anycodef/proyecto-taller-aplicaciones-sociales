import { tablasAsistencia } from "@/lib/asistencia/tablas-sincronizadas";
import { tablaActividades } from "@/lib/actividades/tablas-sincronizadas";
import { tablaCiclos } from "@/lib/ciclos/tablas-sincronizadas";
import type { DefinicionTablaSincronizada } from "./tablas";
import { validarColumnas } from "./columnas-prohibidas";
import { tablaAvisos } from "@/lib/avisos/tablas-sincronizadas";
import { validarProyeccionLocal } from "@/lib/seguridad/catalogo-datos";
const iniciales = [...tablasAsistencia, tablaActividades, tablaCiclos, tablaAvisos];
for (const tabla of iniciales) validarProyeccionLocal(tabla.nombre, Object.keys(tabla.columnas));
const registro = new Map(iniciales.map(tabla => [tabla.nombre, tabla]));
export function registrarTabla(tabla: DefinicionTablaSincronizada): void {
  validarColumnas(tabla);
  validarProyeccionLocal(tabla.nombre, Object.keys(tabla.columnas));
  if (registro.has(tabla.nombre)) throw new Error("Tabla sincronizada ya registrada");
  registro.set(tabla.nombre, tabla);
}
export const obtenerTablas = (): DefinicionTablaSincronizada[] => [...registro.values()];
