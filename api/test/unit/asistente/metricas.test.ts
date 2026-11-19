import type { RespuestaAsistente } from "@/lib/asistente";
import { incrementarContador } from "../../../src/compartido/http/limites";
import { registrarMetricasAsistente } from "../../../src/modulos/asistente/aplicacion/metricas";

jest.mock("../../../src/compartido/http/limites", () => ({ incrementarContador: jest.fn() }));

const respuesta: RespuestaAsistente = {
  respuesta: "La Eucaristía es el sacramento del cuerpo y la sangre de Cristo [Documento, Eucaristía].",
  fuentes: [
    {
      id: "eucaristia",
      documento: "Documento",
      seccion: "Eucaristía",
      fuente: "https://example.org/fuente",
      licencia: "Dominio público",
    },
  ],
  proveedor: "gemini",
  modelo: "gemini-2.5-flash",
  versionCorpus: "v1",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(incrementarContador).mockResolvedValue();
});

test("RF-1006: registra tipo, proveedor y latencia agregada sin guardar contenido", async () => {
  await registrarMetricasAsistente("cuenta-1", respuesta, 123.6);

  expect(incrementarContador).toHaveBeenCalledWith("cuenta-1", "asistente:consultas", 86400);
  expect(incrementarContador).toHaveBeenCalledWith("cuenta-1", "asistente:tipo:respuesta", 86400);
  expect(incrementarContador).toHaveBeenCalledWith("cuenta-1", "asistente:proveedor:gemini", 86400);
  expect(incrementarContador).toHaveBeenCalledWith("cuenta-1", "asistente:latencia_ms", 86400, 124);

  const llamadas = JSON.stringify(jest.mocked(incrementarContador).mock.calls);
  expect(llamadas).not.toContain("Eucaristía");
  expect(llamadas).not.toContain("Documento");
  expect(llamadas).not.toContain("cuerpo y la sangre");
});

test("RF-1006: distingue rechazo de guardia y abstención", async () => {
  await registrarMetricasAsistente("cuenta-1", { ...respuesta, proveedor: "guardia", modelo: "filtro", fuentes: [] }, 5);
  await registrarMetricasAsistente("cuenta-1", { ...respuesta, modelo: "abstencion", fuentes: [] }, 0);

  expect(incrementarContador).toHaveBeenCalledWith("cuenta-1", "asistente:tipo:rechazo", 86400);
  expect(incrementarContador).toHaveBeenCalledWith("cuenta-1", "asistente:tipo:abstencion", 86400);
  expect(incrementarContador).toHaveBeenCalledWith("cuenta-1", "asistente:latencia_ms", 86400, 1);
});
