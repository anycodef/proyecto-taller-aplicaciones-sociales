import { etiquetaSesion, fechaCorta } from "../seleccion";

test("RF-401: la fecha civil se muestra sin correrla de día", () => {
  expect(fechaCorta("2026-11-08")).toBe("8 nov");
  expect(fechaCorta("2026-01-01")).toBe("1 ene");
  expect(fechaCorta("no-es-fecha")).toBe("no-es-fecha");
});

test("RF-401: el tipo de sesión se muestra en español", () => {
  expect(etiquetaSesion("misa")).toBe("Misa");
  expect(etiquetaSesion("catequesis")).toBe("Catequesis");
  expect(etiquetaSesion("actividad")).toBe("Actividad");
});
