import { crearApiAsistente, NOTA_ASISTENTE, preguntaValida, SUGERENCIAS, tipoDeRespuesta, type RespuestaAsistenteApi } from "../api";

const base: RespuestaAsistenteApi = { respuesta: "x", fuentes: [], proveedor: "extractivo", modelo: "extractivo-1", versionCorpus: "v1" };
const fuente = { id: "bautismo", documento: "Catecismo", seccion: "Bautismo", fuente: "https://example.org", licencia: "Dominio público" };

test("RF-1001: preguntar envía POST /asistente/preguntar con la pregunta recortada y nada más", async () => {
  const llamadas: { metodo: string; ruta: string; cuerpo?: unknown }[] = [];
  const api = crearApiAsistente({
    solicitar: async <T,>(metodo: string, ruta: string, cuerpo?: unknown) => {
      llamadas.push({ metodo, ruta, cuerpo });
      return { ...base, fuentes: [fuente] } as T;
    },
  });
  const respuesta = await api.preguntar("  ¿Qué es el bautismo?  ");
  expect(respuesta.fuentes).toHaveLength(1);
  expect(llamadas).toEqual([{ metodo: "POST", ruta: "/asistente/preguntar", cuerpo: { pregunta: "¿Qué es el bautismo?" } }]);
});

test("RF-1005: el error 429 del servidor llega a la pantalla sin ocultarse", async () => {
  const api = crearApiAsistente({
    solicitar: async () => {
      throw Object.assign(new Error("limite_excedido"), { estado: 429, codigo: "limite_excedido" });
    },
  });
  await expect(api.preguntar("¿Qué es la eucaristía?")).rejects.toMatchObject({ estado: 429 });
});

test("RNF-1004: una pregunta de menos de 3 o más de 500 caracteres no se envía", () => {
  expect(preguntaValida("")).toBe(false);
  expect(preguntaValida("  ab  ")).toBe(false);
  expect(preguntaValida("abc")).toBe(true);
  expect(preguntaValida("a".repeat(500))).toBe(true);
  expect(preguntaValida("a".repeat(501))).toBe(false);
});

test("RF-1003 RF-1004: distingue la respuesta citada, la abstención y el rechazo de la guardia", () => {
  expect(tipoDeRespuesta({ ...base, fuentes: [fuente] })).toBe("citada");
  expect(tipoDeRespuesta({ ...base, modelo: "abstencion" })).toBe("abstencion");
  expect(tipoDeRespuesta(base)).toBe("abstencion");
  expect(tipoDeRespuesta({ ...base, proveedor: "guardia", modelo: "filtro" })).toBe("rechazo");
  expect(tipoDeRespuesta({ ...base, modelo: "filtro", fuentes: [fuente] })).toBe("rechazo");
});

test("RF-1001: hay tres sugerencias de arranque y la nota aclara que no sustituye a la coordinación", () => {
  expect(SUGERENCIAS).toHaveLength(3);
  expect(NOTA_ASISTENTE).toMatch(/No sustituye a la coordinación ni da consejo médico o legal/);
});
