import { documentosPendientes, estadoDeAsistencia, estadoDeDocumento, textoRelacion, ultimosDomingos, type PerfilApi } from "../perfil";

const dom = (fecha: string, misa: string, catequesis: string) => ({ fecha, misa, catequesis });

test("RF-201: los últimos domingos son los ya ocurridos, del más reciente al más antiguo", () => {
  const domingos = [
    dom("2026-11-01", "ausente", "ausente"),
    dom("2026-11-15", "pendiente", "sin_registro"),
    dom("2026-11-08", "ausente", "ausente"),
    dom("2026-10-25", "presente", "presente"),
    dom("2026-10-18", "ausente", "ausente"),
  ];
  expect(ultimosDomingos(domingos, 3).map((d) => d.fecha)).toEqual(["2026-11-08", "2026-11-01", "2026-10-25"]);
});

test("RF-201: un domingo sin misa ni catequesis no se muestra", () => {
  expect(ultimosDomingos([dom("2026-11-08", "no_aplica", "no_aplica"), dom("2026-11-01", "presente", "presente")], 5).map((d) => d.fecha)).toEqual(["2026-11-01"]);
});

test("RF-204: cada estado de documento tiene su texto y tono, y uno desconocido no rompe", () => {
  expect(estadoDeDocumento("entregado")).toEqual({ texto: "Entregado", tono: "solido" });
  expect(estadoDeDocumento("pendiente").tono).toBe("advertencia");
  expect(estadoDeDocumento("invalido").tono).toBe("error");
  expect(estadoDeDocumento("raro")).toEqual({ texto: "raro", tono: "neutro" });
});

test("RF-204: cuenta como por entregar los documentos pendientes e inválidos", () => {
  const documentos = [
    { id: "1", tipo: "a", estado: "pendiente", motivo: null, fechaEstado: "x" },
    { id: "2", tipo: "b", estado: "invalido", motivo: "ilegible", fechaEstado: "x" },
    { id: "3", tipo: "c", estado: "entregado", motivo: null, fechaEstado: "x" },
    { id: "4", tipo: "d", estado: "no_aplica", motivo: null, fechaEstado: "x" },
  ] as PerfilApi["documentos"];
  expect(documentosPendientes(documentos)).toBe(2);
});

test("RF-311: la asistencia se muestra como presente, ausente o sin registro", () => {
  expect(estadoDeAsistencia("presente").texto).toBe("Presente");
  expect(estadoDeAsistencia("ausente")).toEqual({ texto: "Ausente", tono: "error" });
  expect(estadoDeAsistencia("sin_registro").texto).toBe("Sin registro");
});

test("RF-207: la relación del apoderado usa el detalle si existe", () => {
  expect(textoRelacion("madre", null)).toBe("Madre");
  expect(textoRelacion("otro", "Abuela")).toBe("Abuela");
});
