import { ProveedorExtractivo, ProveedorLLM } from "@/lib/asistente";
import { crearProveedorAsistente } from "../../../src/modulos/asistente/aplicacion/proveedores";

test("RNF-1002: sin proveedor configurado usa el extractivo", () => {
  expect(crearProveedorAsistente({})).toBeInstanceOf(ProveedorExtractivo);
  expect(crearProveedorAsistente({ ASISTENTE_PROVEEDOR: "desconocido" })).toBeInstanceOf(ProveedorExtractivo);
});

test("RNF-1002: Gemini sin clave cae al extractivo para no romper la demo", () => {
  expect(crearProveedorAsistente({ ASISTENTE_PROVEEDOR: "gemini", ASISTENTE_CLAVE: "" })).toBeInstanceOf(ProveedorExtractivo);
});

test("RNF-1002: Gemini con clave usa el modelo y timeout configurados", () => {
  const proveedor = crearProveedorAsistente({
    ASISTENTE_PROVEEDOR: "gemini",
    ASISTENTE_CLAVE: "clave-secreta",
    ASISTENTE_MODELO: "gemini-2.5-flash",
    ASISTENTE_TIMEOUT_MS: "6000",
  });

  expect(proveedor).toBeInstanceOf(ProveedorLLM);
  expect(proveedor).toMatchObject({ proveedor: "gemini", modelo: "gemini-2.5-flash", timeoutMs: 6000 });
});

test("RNF-1002: Groq y Ollama comparten el mismo puerto de proveedor", () => {
  const groq = crearProveedorAsistente({ ASISTENTE_PROVEEDOR: "groq", ASISTENTE_CLAVE: "clave-groq" });
  const ollama = crearProveedorAsistente({ ASISTENTE_PROVEEDOR: "ollama", ASISTENTE_URL: "http://127.0.0.1:11434/api/chat" });

  expect(groq).toMatchObject({ proveedor: "groq", modelo: "llama-3.3-70b-versatile" });
  expect(ollama).toMatchObject({ proveedor: "ollama", modelo: "llama3.2:3b" });
});
