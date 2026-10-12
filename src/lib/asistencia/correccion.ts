import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { puedeCorregir } from "./autorizacion";
import { horaEfectiva } from "./reloj";
import { finDelDomingo } from "./sesiones";
import type { Correccion, ParametrosAsistencia } from "./tipos";
export function validarCorreccion(entrada: Correccion, cuenta: ContextoAcceso, autores: string[], fecha: string, recibidoEn: number, parametros?: ParametrosAsistencia): string | null {
  const hora = horaEfectiva(entrada.horaDispositivo, entrada.desfaseRelojMs);
  if (hora > recibidoEn || hora < Date.parse(`${fecha}T00:00:00-05:00`)) return "hora_incoherente";
  return puedeCorregir(cuenta, autores, hora, finDelDomingo(fecha, parametros), entrada.motivo) ? null : "correccion_no_autorizada";
}
