import { rolesEfectivos, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { NinoNomina } from "./tipos";
export const puedeEscanear = (cuenta: ContextoAcceso): boolean => rolesEfectivos(cuenta).includes("catequista");
export const puedeConfigurarSesiones = (cuenta: ContextoAcceso): boolean => rolesEfectivos(cuenta).includes("coordinacion");
export const puedeVerNombreAlEscanear = (cuenta: ContextoAcceso, nino: Pick<NinoNomina, "grupoId">): boolean => cuenta.gruposAsignados.includes(nino.grupoId);
export const puedeRegistrarManual = (cuenta: ContextoAcceso, nino: Pick<NinoNomina, "grupoId">): boolean => puedeEscanear(cuenta) && puedeVerNombreAlEscanear(cuenta, nino);
export const puedePasarLista = (cuenta: ContextoAcceso): boolean => puedeEscanear(cuenta);
export function puedeCorregir(cuenta: ContextoAcceso, autores: string[], hora: number, finDomingo: number, motivo?: string | null): boolean {
  if (hora <= finDomingo) return autores.includes(cuenta.cuentaId) && puedeEscanear(cuenta);
  return puedeConfigurarSesiones(cuenta) && Boolean(motivo?.trim());
}
