import { crearClienteHttp } from "../cliente";

type Peticion = { url: string; init: RequestInit };

function respuestaFalsa(estado: number, cuerpo: unknown): Response {
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => cuerpo,
  } as unknown as Response;
}

function opcionesBase(overrides: Partial<Parameters<typeof crearClienteHttp>[0]> = {}) {
  return {
    urlBase: "https://api.ejemplo/v1",
    claveSuscripcion: "clave-de-suscripcion",
    obtenerToken: async () => "jwt-inicial",
    renovarSesion: async () => "jwt-renovado",
    irASinAcceso: () => undefined,
    ...overrides,
  };
}

test("RF-101: ante 401 el cliente renueva una vez y reintenta", async () => {
  const peticiones: Peticion[] = [];
  const respuestas = [respuestaFalsa(401, { codigo: "acceso_denegado" }), respuestaFalsa(200, { ok: true })];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    peticiones.push({ url, init });
    return respuestas[peticiones.length - 1];
  }) as unknown as typeof fetch;

  const cliente = crearClienteHttp(opcionesBase({ fetchImpl }));

  const resultado = await cliente.solicitar<{ ok: boolean }>("GET", "/yo");

  expect(resultado).toEqual({ ok: true });
  expect(peticiones).toHaveLength(2);
  expect((peticiones[0].init.headers as Record<string, string>).authorization).toBe("Bearer jwt-inicial");
  expect((peticiones[1].init.headers as Record<string, string>).authorization).toBe("Bearer jwt-renovado");
  expect((peticiones[0].init.headers as Record<string, string>)["ocp-apim-subscription-key"]).toBe(
    "clave-de-suscripcion"
  );
  expect(peticiones[0].url).toBe("https://api.ejemplo/v1/yo");
});

test("RF-101: con credencial_terminada el cliente lleva a sin-acceso", async () => {
  const irASinAcceso = jest.fn();
  const renovarSesion = jest.fn(async () => "jwt-renovado");
  const fetchImpl = (async () => respuestaFalsa(401, { codigo: "credencial_terminada" })) as unknown as typeof fetch;

  const cliente = crearClienteHttp(
    opcionesBase({ fetchImpl, irASinAcceso, renovarSesion, contarPendientes: () => 3 })
  );

  await expect(cliente.solicitar("GET", "/yo")).rejects.toMatchObject({
    estado: 401,
    codigo: "credencial_terminada",
  });

  expect(irASinAcceso).toHaveBeenCalledWith(3);
  expect(renovarSesion).not.toHaveBeenCalled();
});

test("RNF-103: el cliente rechaza una URL base sin HTTPS fuera de desarrollo", () => {
  const insegura = { ...opcionesBase({ urlBase: "http://api.ejemplo/v1" }) };

  expect(() => crearClienteHttp(insegura)).toThrow("url_base_insegura");
  expect(() => crearClienteHttp({ ...insegura, enDesarrollo: true })).not.toThrow();
});
