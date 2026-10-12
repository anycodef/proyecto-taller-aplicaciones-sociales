import { rolesEfectivos, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { DefinicionTablaSincronizada } from "./tablas";
export function huellaAlcance(cuenta: ContextoAcceso, cicloId = "", revision = ""): string {
  return JSON.stringify([cuenta.cuentaId, cuenta.credencialId, [...rolesEfectivos(cuenta)].sort(), [...cuenta.gruposAsignados].sort(), cicloId, revision]);
}
export const requiereReemplazo = (cliente: string | null | undefined, servidor: string): boolean => cliente !== servidor;
export function filtroPull(tabla: DefinicionTablaSincronizada, cuenta: ContextoAcceso): { tipo: "ciclo" | "mis_grupos" | "propias"; ids: string[] } {
  if (rolesEfectivos(cuenta).includes("coordinacion") || tabla.alcance === "ciclo") return { tipo: "ciclo", ids: [] };
  return tabla.alcance === "propias" ? { tipo: "propias", ids: [cuenta.cuentaId] } : { tipo: "mis_grupos", ids: cuenta.gruposAsignados };
}
