import { LIMITE_BYTES, validarMetadatos } from "@/lib/justificaciones/evidencia";

const foto = (bytes = 200_000, contentType = "image/jpeg") => ({ contentType, bytes });

test("RNF-402: rechaza un archivo de más de 307 200 bytes", () => {
  expect(LIMITE_BYTES).toBe(307_200);
  expect(validarMetadatos([foto(307_201)])).toEqual({ valida: false, motivo: "tamano_invalido" });
  expect(validarMetadatos([foto(0)])).toEqual({ valida: false, motivo: "tamano_invalido" });
  expect(validarMetadatos([foto(307_200)])).toEqual({ valida: true });
});

test("RNF-403: rechaza un content-type distinto de image/jpeg", () => {
  expect(validarMetadatos([foto(1000, "image/png")])).toEqual({ valida: false, motivo: "tipo_no_permitido" });
  expect(validarMetadatos([foto(1000, "application/pdf")])).toEqual({ valida: false, motivo: "tipo_no_permitido" });
});

test("RF-402: exige entre 1 y 3 fotos", () => {
  expect(validarMetadatos([])).toEqual({ valida: false, motivo: "cantidad_fotos" });
  expect(validarMetadatos([foto(), foto(), foto()])).toEqual({ valida: true });
  expect(validarMetadatos([foto(), foto(), foto(), foto()])).toEqual({ valida: false, motivo: "cantidad_fotos" });
});
