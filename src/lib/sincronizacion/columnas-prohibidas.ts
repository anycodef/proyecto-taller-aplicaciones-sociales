import type { DefinicionTablaSincronizada } from "./tablas";
export const COLUMNAS_PROHIBIDAS = /salud|condicion|neuro|documento|dni|evidencia|nota_apoyo|fecha_nacimiento|identidad_real|apoderado|telefono|direccion/i;
export function validarColumnas(tabla: DefinicionTablaSincronizada): void {
  if (Object.keys(tabla.columnas).some(columna => COLUMNAS_PROHIBIDAS.test(columna))) throw new Error("Columna restringida en sincronización");
  if (tabla.columnasOpcionales?.some(columna => !(columna in tabla.columnas))) throw new Error("Columna opcional desconocida");
}
