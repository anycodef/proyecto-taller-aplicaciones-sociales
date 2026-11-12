import { agruparPorNinoYFecha, diasRestantes, etiquetaDiasRestantes, etiquetaFecha, etiquetaFechaCorta, etiquetaSesiones, nombresSesiones, unirNombres } from "@/lib/justificaciones/presentacion";

test("RF-401: la fecha se muestra en español con el día de la semana", () => {
  expect(etiquetaFecha("2026-11-08")).toBe("domingo 8 de noviembre");
  expect(etiquetaFecha("2026-11-15T23:59:59-05:00")).toBe("domingo 15 de noviembre");
});

test("RF-401: misa y catequesis del mismo domingo se nombran juntas", () => {
  expect(etiquetaSesiones([{ tipoSesion: "misa" }, { tipoSesion: "catequesis" }])).toBe("Misa y catequesis");
  expect(etiquetaSesiones([{ tipoSesion: "actividad" }])).toBe("Actividad obligatoria");
});

test("RF-401: la fecha corta y las sesiones por separado se leen en la tarjeta", () => {
  expect(etiquetaFechaCorta("2026-11-08")).toBe("dom 8 nov");
  expect(nombresSesiones([{ tipoSesion: "misa" }, { tipoSesion: "catequesis" }, { tipoSesion: "misa" }])).toEqual(["Misa", "Catequesis"]);
});

test("RF-405: los días que quedan del plazo se cuentan en fechas civiles", () => {
  expect(diasRestantes("2026-11-15", "2026-11-12")).toBe(3);
  expect(diasRestantes("2026-11-15T23:59:59-05:00", "2026-11-15")).toBe(0);
  expect(diasRestantes("2026-11-15", "2026-11-20")).toBe(0);
  expect(etiquetaDiasRestantes(3)).toBe("Quedan 3 días");
  expect(etiquetaDiasRestantes(1)).toBe("Queda 1 día");
  expect(etiquetaDiasRestantes(0)).toBe("Vence hoy");
});

test("RF-403: misa y catequesis del mismo niño y fecha se agrupan; otro niño queda aparte", () => {
  const items = [
    { id: "1", catequizandoId: "a", fecha: "2026-11-08", estado: "pendiente" },
    { id: "2", catequizandoId: "b", fecha: "2026-11-08", estado: "pendiente" },
    { id: "3", catequizandoId: "a", fecha: "2026-11-08", estado: "pendiente" },
    { id: "4", catequizandoId: "a", fecha: "2026-11-08", estado: "rechazada" },
  ];
  expect(agruparPorNinoYFecha(items).map((g) => g.map((i) => i.id))).toEqual([["1", "3", "4"], ["2"]]);
  expect(agruparPorNinoYFecha(items, (i) => i.estado).map((g) => g.map((i) => i.id))).toEqual([["1", "3"], ["2"], ["4"]]);
  expect(unirNombres(["Ana", "Luis", "Ana"])).toBe("Ana y Luis");
  expect(unirNombres(["Ana", "Luis", "Rosa"])).toBe("Ana, Luis y Rosa");
});
