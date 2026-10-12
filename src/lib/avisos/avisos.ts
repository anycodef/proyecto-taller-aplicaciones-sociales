import { autorizar } from "@/lib/seguridad/autorizacion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
export const validarAviso = (texto: string): boolean => texto.trim().length >= 1 && texto.length <= 500;
export function avisosVisibles<T extends { grupoId: string; retiradoEn?: string | null }>(avisos: T[], contexto: ContextoAcceso): T[] {
  return avisos.filter(a => !a.retiradoEn && autorizar(contexto, "aviso:leer", { grupoId: a.grupoId }).permitido);
}
