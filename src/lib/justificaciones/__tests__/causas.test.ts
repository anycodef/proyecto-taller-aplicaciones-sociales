import { CAUSAS, ETIQUETAS_CAUSA, esCausaValida, permiteAnticipada } from "@/lib/justificaciones/causas";

test("RF-402: la lista de causas es exactamente salud_nino, familiar_directo y evento_escolar", () => {
  expect([...CAUSAS]).toEqual(["salud_nino", "familiar_directo", "evento_escolar"]);
  expect(ETIQUETAS_CAUSA.familiar_directo).toBe("Enfermedad o fallecimiento de un familiar directo");
});

test("RF-402: rechaza una causa fuera de la lista (viaje)", () => {
  expect(esCausaValida("viaje")).toBe(false);
  expect(esCausaValida("fiesta")).toBe(false);
  expect(esCausaValida("salud_nino")).toBe(true);
});

test("RF-404: solo evento_escolar permite justificación anticipada", () => {
  expect(CAUSAS.filter(permiteAnticipada)).toEqual(["evento_escolar"]);
});
