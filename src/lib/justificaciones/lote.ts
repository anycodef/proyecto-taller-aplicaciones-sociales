import { esCausaValida, permiteAnticipada } from "./causas";
import { MAXIMO_FOTOS, MINIMO_FOTOS } from "./evidencia";
import type { AusenciaRef, EntradaLote } from "./tipos";

export type MotivoLoteInvalido =
  | "sin_ausencias"
  | "ausencia_repetida"
  | "causa_invalida"
  | "sin_evidencia"
  | "nino_ajeno"
  | "anticipada_no_permitida"
  | "no_justificable"
  | "registro_sin_autor";
export type ResultadoLote = { valido: true } | { valido: false; motivo: MotivoLoteInvalido; sesionId?: string };

/** Lo calcula el servidor: hijos del apoderado y ausencias ofrecibles hoy. */
export type ContextoLote = {
  hijosDelApoderado: readonly string[];
  justificables: readonly AusenciaRef[];
  anticipables: readonly AusenciaRef[];
};

const clave = (a: Pick<AusenciaRef, "catequizandoId" | "sesionId">) => `${a.catequizandoId}|${a.sesionId}`;

/** La coordinación queda sujeta al mismo plazo que la familia (supuesto A-04). */
export function validarLote(entrada: EntradaLote, contexto: ContextoLote): ResultadoLote {
  if (entrada.ausencias.length === 0) return { valido: false, motivo: "sin_ausencias" };
  if (!esCausaValida(entrada.causa)) return { valido: false, motivo: "causa_invalida" };
  if (entrada.cantidadFotos < MINIMO_FOTOS || entrada.cantidadFotos > MAXIMO_FOTOS) return { valido: false, motivo: "sin_evidencia" };
  if (entrada.canal === "coordinacion" && !entrada.registradaPor) return { valido: false, motivo: "registro_sin_autor" };
  const vistas = new Set<string>();
  const justificables = new Set(contexto.justificables.map(clave));
  const anticipables = new Set(contexto.anticipables.map(clave));
  for (const item of entrada.ausencias) {
    const sesionId = item.sesionId;
    if (vistas.has(clave(item))) return { valido: false, motivo: "ausencia_repetida", sesionId };
    vistas.add(clave(item));
    if (!contexto.hijosDelApoderado.includes(item.catequizandoId)) return { valido: false, motivo: "nino_ajeno", sesionId };
    if (item.anticipada && !permiteAnticipada(entrada.causa)) return { valido: false, motivo: "anticipada_no_permitida", sesionId };
    if (!(item.anticipada ? anticipables : justificables).has(clave(item))) return { valido: false, motivo: "no_justificable", sesionId };
  }
  return { valido: true };
}
