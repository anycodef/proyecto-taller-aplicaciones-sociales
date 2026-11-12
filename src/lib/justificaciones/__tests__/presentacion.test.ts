import { etiquetaFecha, etiquetaSesiones } from "@/lib/justificaciones/presentacion";

test("RF-401: la fecha se muestra en español con el día de la semana", () => {
  expect(etiquetaFecha("2026-11-08")).toBe("domingo 8 de noviembre");
  expect(etiquetaFecha("2026-11-15T23:59:59-05:00")).toBe("domingo 15 de noviembre");
});

test("RF-401: misa y catequesis del mismo domingo se nombran juntas", () => {
  expect(etiquetaSesiones([{ tipoSesion: "misa" }, { tipoSesion: "catequesis" }])).toBe("Misa y catequesis");
  expect(etiquetaSesiones([{ tipoSesion: "actividad" }])).toBe("Actividad obligatoria");
});
