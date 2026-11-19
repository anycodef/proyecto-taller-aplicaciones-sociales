import { crearPregunta, ErrorProveedor, ProveedorLLM, type EntradaProveedor } from "@/lib/asistente";

const fragmento = {
  id: "eucaristia",
  documento: "Documento",
  seccion: "Eucaristía",
  texto: "La Eucaristía es el sacramento del cuerpo y la sangre de Cristo.",
  fuente: "https://example.org/fuente",
  licencia: "Dominio público",
  version: "v1",
};

const entrada: EntradaProveedor = {
  pregunta: crearPregunta("¿Qué es la Eucaristía?"),
  fragmentos: [fragmento],
};

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as unknown as Response;
}

function fetchFalso(resultado: Response): jest.Mock {
  return jest.fn().mockResolvedValue(resultado);
}

test("RNF-1002: Gemini recibe la pregunta, los fragmentos y devuelve proveedor/modelo", async () => {
  const fetchImpl = fetchFalso(respuestaJson({ candidates: [{ content: { parts: [{ text: "Respuesta [Documento, Eucaristía]." }] } }] }));
  const proveedor = new ProveedorLLM({
    proveedor: "gemini",
    modelo: "gemini-2.5-flash",
    clave: "clave-secreta",
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

  const salida = await proveedor.generar(entrada);
  expect(salida).toEqual({
    texto: "Respuesta [Documento, Eucaristía].",
    proveedor: "gemini",
    modelo: "gemini-2.5-flash",
  });

  const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
  expect(url).toContain("generativelanguage.googleapis.com");
  expect(url).toContain("key=clave-secreta");
  expect(init.method).toBe("POST");
  const cuerpo = JSON.parse(String(init.body)) as { contents: { parts: { text: string }[] }[] };
  expect(cuerpo.contents[0].parts[0].text).toContain("Pregunta: ¿Qué es la Eucaristía?");
  expect(cuerpo.contents[0].parts[0].text).toContain("[Documento, Eucaristía]");
  expect(JSON.stringify(cuerpo)).not.toContain("nombre del niño");
});

test("RNF-1002: Groq usa su endpoint compatible con OpenAI y la clave en el encabezado", async () => {
  const fetchImpl = fetchFalso(respuestaJson({ choices: [{ message: { content: "Respuesta [Documento, Eucaristía]." } }] }));
  const proveedor = new ProveedorLLM({
    proveedor: "groq",
    modelo: "llama-3.3-70b-versatile",
    clave: "clave-groq",
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

  await proveedor.generar(entrada);
  const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
  expect((init.headers as Record<string, string>).authorization).toBe("Bearer clave-groq");
  const cuerpo = JSON.parse(String(init.body)) as { model: string; messages: { content: string }[] };
  expect(cuerpo.model).toBe("llama-3.3-70b-versatile");
  expect(cuerpo.messages[0].content).toContain("[Documento, Eucaristía]");
});

test("RNF-1002: Ollama funciona sin clave y usa el endpoint local configurable", async () => {
  const fetchImpl = fetchFalso(respuestaJson({ message: { content: "Respuesta [Documento, Eucaristía]." } }));
  const proveedor = new ProveedorLLM({
    proveedor: "ollama",
    modelo: "llama3.2:3b",
    url: "http://127.0.0.1:11434/api/chat",
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

  const salida = await proveedor.generar(entrada);
  expect(salida.proveedor).toBe("ollama");
  const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
  expect((init.headers as Record<string, string>).authorization).toBeUndefined();
});

test("RNF-1002: sin clave Gemini/Groq no se construye el proveedor", () => {
  expect(() => new ProveedorLLM({ proveedor: "gemini", modelo: "gemini-2.5-flash" })).toThrow(ErrorProveedor);
});

test("RNF-1002: un error HTTP se reporta como proveedor no disponible", async () => {
  const proveedor = new ProveedorLLM({
    proveedor: "gemini",
    modelo: "gemini-2.5-flash",
    clave: "clave-secreta",
    fetchImpl: fetchFalso(respuestaJson({}, 401)) as unknown as typeof fetch,
  });

  await expect(proveedor.generar(entrada)).rejects.toMatchObject({ codigo: "proveedor_no_disponible" });
});

test("RNF-1002: una respuesta vacía se reporta como inválida", async () => {
  const proveedor = new ProveedorLLM({
    proveedor: "gemini",
    modelo: "gemini-2.5-flash",
    clave: "clave-secreta",
    fetchImpl: fetchFalso(respuestaJson({ candidates: [] })) as unknown as typeof fetch,
  });

  await expect(proveedor.generar(entrada)).rejects.toMatchObject({ codigo: "respuesta_invalida" });
});

test("RNF-1002: el timeout de 8 s se puede acortar y no deja la petición colgada", async () => {
  const fetchImpl = jest.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolver, rechazar) => {
        init?.signal?.addEventListener("abort", () => rechazar(new Error("abortado")));
      }),
  );
  const proveedor = new ProveedorLLM({
    proveedor: "gemini",
    modelo: "gemini-2.5-flash",
    clave: "clave-secreta",
    timeoutMs: 10,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

  await expect(proveedor.generar(entrada)).rejects.toMatchObject({ codigo: "tiempo_agotado" });
});
