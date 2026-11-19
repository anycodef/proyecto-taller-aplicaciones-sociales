import { PLAZO_PREDETERMINADO_DIAS, fechaLimite, plazoVigente, validarDiasPlazo } from "@/lib/justificaciones/plazo";

test("RF-405: el plazo vence al final del día calendario en America/Lima", () => {
  expect(fechaLimite("2026-11-01", 7)).toBe("2026-11-08T23:59:59-05:00");
  expect(plazoVigente("2026-11-01", 7, new Date("2026-11-09T04:59:00Z"))).toBe(true);
});

test("RF-405: un minuto después del límite el plazo ya no está vigente", () => {
  expect(plazoVigente("2026-11-01", 7, new Date("2026-11-09T05:01:00Z"))).toBe(false);
});

test("RF-405: rechaza un plazo fuera de 1 a 60 días", () => {
  expect(() => validarDiasPlazo(0)).toThrow("plazo_invalido");
  expect(() => validarDiasPlazo(61)).toThrow("plazo_invalido");
  expect(() => validarDiasPlazo(2.5)).toThrow("plazo_invalido");
  expect(() => fechaLimite("2026-11-01", 0)).toThrow("plazo_invalido");
  expect(() => validarDiasPlazo(1)).not.toThrow();
  expect(() => validarDiasPlazo(60)).not.toThrow();
});

test("RF-405: el plazo por defecto es 7 días", () => {
  expect(PLAZO_PREDETERMINADO_DIAS).toBe(7);
});
