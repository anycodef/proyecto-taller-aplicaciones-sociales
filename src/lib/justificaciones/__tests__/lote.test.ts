import { expandirLote, validarLote, type ContextoLote } from "@/lib/justificaciones/lote";
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

const enviadaEn = "2026-11-04T10:00:00-05:00";
const domingos: AusenciaRef[] = ["2026-10-25", "2026-11-01", "2026-11-08"].map(fecha => ({ catequizandoId: "nino-1", sesionId: `misa-${fecha}`, tipoSesion: "misa", fecha }));

test("RF-403: un lote de tres fechas crea tres justificaciones con la misma evidencia", () => {
  const js = expandirLote(lote({ ausencias: domingos.map(a => item(a)) }), enviadaEn);
  expect(js).toHaveLength(3);
  expect(js.map(j => j.fecha)).toEqual(["2026-10-25", "2026-11-01", "2026-11-08"]);
  expect(new Set(js.map(j => j.evidenciaId))).toEqual(new Set(["ev-1"]));
  expect(new Set(js.map(j => j.loteId))).toEqual(new Set(["lote-1"]));
  expect(new Set(js.map(j => j.id)).size).toBe(3);
  expect(js.every(j => j.causa === "salud_nino" && j.estadoRevision === "pendiente")).toBe(true);
});

test("RF-403: una evidencia, una justificación por niño (hermanos)", () => {
  const hermano = item({ ...misa, catequizandoId: "nino-2" });
  const js = expandirLote(lote({ ausencias: [item(misa), hermano] }), enviadaEn);
  expect(js.map(j => j.catequizandoId)).toEqual(["nino-1", "nino-2"]);
  expect(js.map(j => j.evidenciaId)).toEqual(["ev-1", "ev-1"]);
});

test("RF-406: el canal coordinación lleva registrada_por y registrada_en", () => {
  const [enNombre] = expandirLote(lote({ canal: "coordinacion", registradaPor: "coord-1" }), enviadaEn);
  expect(enNombre).toMatchObject({ canal: "coordinacion", enviadaPor: "apoderado-1", registradaPor: "coord-1", registradaEn: enviadaEn });
  const [porEnlace] = expandirLote(lote(), enviadaEn);
  expect(porEnlace).toMatchObject({ canal: "enlace", registradaPor: null, registradaEn: null });
  expect(() => expandirLote(lote({ canal: "coordinacion" }), enviadaEn)).toThrow("registro_sin_autor");
});

test("RF-407: cada justificación queda ligada a niño, sesión, fecha y tipo", () => {
  const [j] = expandirLote(lote(), enviadaEn);
  expect(j).toMatchObject({ id: "j-nino-1-misa-0101", catequizandoId: "nino-1", sesionId: "misa-0101", fecha: "2026-11-01", tipoSesion: "misa", enviadaPor: "apoderado-1", enviadaEn });
});
