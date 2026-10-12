export const DIAS_SESION_SIN_CONEXION = 14;
export type EstadoSesion = "operativa" | "requiere-conexion" | "bloqueada";
export function estadoSesionLocal(datos: { ahoraDispositivo: number; instanteMaximoVisto: number; ultimaRenovacion: number; intentosFallidos: number; bloqueada: boolean }): EstadoSesion {
  if (datos.bloqueada || datos.intentosFallidos >= 5) return "bloqueada";
  const ahora = Math.max(datos.ahoraDispositivo, datos.instanteMaximoVisto);
  if (![ahora, datos.ultimaRenovacion].every(Number.isFinite) || ahora < datos.ultimaRenovacion || ahora - datos.ultimaRenovacion >= 14 * 86400000) return "requiere-conexion";
  return "operativa";
}
export const puedeRegistrarSinConexion = (estado: EstadoSesion): boolean => estado === "operativa";
