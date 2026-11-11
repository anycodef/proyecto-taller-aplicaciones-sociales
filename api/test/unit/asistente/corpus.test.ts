import { evaluarGuardia } from "@/lib/asistente";
import { corpusAsistente } from "../../../src/modulos/asistente";

test("RF-1002 RF-1005 RNF-1005: el corpus es público, versionado, citables y sin datos sensibles", () => {
  expect(corpusAsistente.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  expect(corpusAsistente.fragmentos).toHaveLength(10);

  for (const fragmento of corpusAsistente.fragmentos) {
    expect(fragmento.id).toMatch(/^[a-z0-9-]+$/);
    expect(fragmento.documento.length).toBeGreaterThan(0);
    expect(fragmento.seccion.length).toBeGreaterThan(0);
    expect(fragmento.texto.length).toBeGreaterThan(20);
    expect(fragmento.fuente.length).toBeGreaterThan(10);
    expect(fragmento.licencia).toBe("Dominio público");
    expect(fragmento.version).toBe(corpusAsistente.version);
    expect(evaluarGuardia(fragmento.texto).permitida).toBe(true);
  }
});
