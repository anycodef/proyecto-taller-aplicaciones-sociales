import { validarLote, type ContextoLote } from "@/lib/justificaciones/lote";
import type { AusenciaRef, EntradaLote, ItemLote } from "@/lib/justificaciones/tipos";

const misa: AusenciaRef = { catequizandoId: "nino-1", sesionId: "misa-0101", tipoSesion: "misa", fecha: "2026-11-01" };
const futura: AusenciaRef = { catequizandoId: "nino-1", sesionId: "misa-1115", tipoSesion: "misa", fecha: "2026-11-15" };
const item = (a: AusenciaRef, parcial: Partial<ItemLote> = {}): ItemLote => ({ ...a, justificacionId: `j-${a.catequizandoId}-${a.sesionId}`, anticipada: false, ...parcial });
const contexto: ContextoLote = { hijosDelApoderado: ["nino-1", "nino-2"], justificables: [misa], anticipables: [futura] };

function lote(parcial: Partial<EntradaLote> = {}): EntradaLote {
  return { loteId: "lote-1", cicloId: "ciclo-1", causa: "salud_nino", evidenciaId: "ev-1", cantidadFotos: 1, apoderadoId: "apoderado-1", canal: "enlace", ausencias: [item(misa)], ...parcial };
}

test("RF-402: rechaza un lote sin foto", () => {
  expect(validarLote(lote({ cantidadFotos: 0 }), contexto)).toEqual({ valido: false, motivo: "sin_evidencia" });
  expect(validarLote(lote(), contexto)).toEqual({ valido: true });
});

test("RF-402: rechaza una causa no listada", () => {
  expect(validarLote(lote({ causa: "viaje" }), contexto)).toEqual({ valido: false, motivo: "causa_invalida" });
});

test("RF-403: rechaza ausencias de un niño que no es hijo del apoderado", () => {
  const ajena = item({ ...misa, catequizandoId: "nino-9" });
  expect(validarLote(lote({ ausencias: [item(misa), ajena] }), contexto)).toEqual({ valido: false, motivo: "nino_ajeno", sesionId: "misa-0101" });
  expect(validarLote(lote({ ausencias: [item(misa), item(misa)] }), contexto)).toEqual({ valido: false, motivo: "ausencia_repetida", sesionId: "misa-0101" });
});

test("RF-404: rechaza una anticipada con causa distinta de evento escolar", () => {
  const anticipada = item(futura, { anticipada: true });
  expect(validarLote(lote({ ausencias: [anticipada] }), contexto)).toEqual({ valido: false, motivo: "anticipada_no_permitida", sesionId: "misa-1115" });
  expect(validarLote(lote({ causa: "evento_escolar", ausencias: [anticipada] }), contexto)).toEqual({ valido: true });
});

test("RF-405: la coordinación tampoco puede justificar una ausencia vencida", () => {
  const vencida = item({ ...misa, sesionId: "misa-1018", fecha: "2026-10-18" });
  const enNombre = lote({ canal: "coordinacion", registradaPor: "coord-1", ausencias: [vencida] });
  expect(validarLote(enNombre, contexto)).toEqual({ valido: false, motivo: "no_justificable", sesionId: "misa-1018" });
  expect(validarLote(lote({ canal: "coordinacion" }), contexto)).toEqual({ valido: false, motivo: "registro_sin_autor" });
});
