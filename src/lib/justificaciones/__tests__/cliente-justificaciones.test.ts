import { crearClienteJustificaciones, type ClienteHttpJustificaciones } from "../cliente-justificaciones";

type Llamada = { metodo: string; ruta: string; cuerpo?: unknown };

function clienteDoble(respuestas: Record<string, unknown>, llamadas: Llamada[] = []): { cliente: ClienteHttpJustificaciones; llamadas: Llamada[]; binarios: { ruta: string; tipo: string; datos: unknown }[] } {
  const binarios: { ruta: string; tipo: string; datos: unknown }[] = [];
  const cliente: ClienteHttpJustificaciones = {
    solicitar: async <T,>(metodo: string, ruta: string, cuerpo?: unknown) => {
      llamadas.push({ metodo, ruta, cuerpo });
      return respuestas[`${metodo} ${ruta}`] as T;
    },
    solicitarBinario: async <T,>(metodo: string, ruta: string, datos: unknown, tipo: string) => {
      binarios.push({ ruta, tipo, datos });
      return { orden: 1, bytes: 3 } as T;
    },
  };
  return { cliente, llamadas, binarios };
}

const id = "00000000-0000-4000-8000-000000000001";

test("RF-401: pide las ausencias justificables y devuelve el arreglo", async () => {
  const { cliente, llamadas } = clienteDoble({ "GET /familia/ausencias-justificables": { ausencias: [{ sesionId: id }] } });
  expect(await crearClienteJustificaciones(cliente).ausenciasJustificables()).toEqual([{ sesionId: id }]);
  expect(llamadas).toEqual([{ metodo: "GET", ruta: "/familia/ausencias-justificables", cuerpo: undefined }]);
});

test("RF-410: lista las justificaciones de la familia", async () => {
  const { cliente } = clienteDoble({ "GET /familia/justificaciones": { justificaciones: [{ id, estadoVisible: "pendiente" }] } });
  expect(await crearClienteJustificaciones(cliente).misJustificaciones()).toEqual([{ id, estadoVisible: "pendiente" }]);
});

test("RF-402: reserva la evidencia con los archivos declarados", async () => {
  const { cliente, llamadas } = clienteDoble({ "POST /evidencias/reservas": { evidenciaId: id, archivos: [{ orden: 1 }] } });
  const reserva = await crearClienteJustificaciones(cliente).reservarEvidencia([{ bytes: 1000, contentType: "image/jpeg" }]);
  expect(reserva.evidenciaId).toBe(id);
  expect(llamadas[0]).toEqual({ metodo: "POST", ruta: "/evidencias/reservas", cuerpo: { archivos: [{ bytes: 1000, contentType: "image/jpeg" }] } });
});

test("RNF-402: la foto se sube como binario image/jpeg a la ruta de su orden", async () => {
  const { cliente, binarios } = clienteDoble({});
  const datos = new Uint8Array([0xff, 0xd8, 0xff]);
  await crearClienteJustificaciones(cliente).subirArchivo(id, 2, datos);
  expect(binarios).toEqual([{ ruta: `/evidencias/${id}/archivos/2`, tipo: "image/jpeg", datos }]);
});

test("RNF-404: sin soporte de subida binaria falla en vez de guardar la foto", () => {
  const sinBinario: ClienteHttpJustificaciones = { solicitar: async () => undefined as never };
  expect(() => crearClienteJustificaciones(sinBinario).subirArchivo(id, 1, new Uint8Array([1]))).toThrow("subida_no_disponible");
});

test("RF-403: envía el lote con una justificación por ausencia", async () => {
  const lote = { loteId: id, causa: "salud_nino" as const, evidenciaId: id, ausencias: [{ catequizandoId: id, sesionId: id, justificacionId: id }] };
  const { cliente, llamadas } = clienteDoble({ "POST /justificaciones/lotes": { loteId: id, justificaciones: [] } });
  await crearClienteJustificaciones(cliente).crearLote(lote);
  expect(llamadas[0]).toEqual({ metodo: "POST", ruta: "/justificaciones/lotes", cuerpo: lote });
});

test("RF-408: la bandeja devuelve los lotes", async () => {
  const { cliente } = clienteDoble({ "GET /justificaciones/bandeja": { lotes: [{ loteId: id, justificaciones: [] }] } });
  expect(await crearClienteJustificaciones(cliente).bandeja()).toEqual([{ loteId: id, justificaciones: [] }]);
});

test("RF-406: aprobar omite el motivo y rechazar lo envía", async () => {
  const { cliente, llamadas } = clienteDoble({ "POST /justificaciones/revisiones": { revisadas: [] } });
  const api = crearClienteJustificaciones(cliente);
  await api.revisar([id], "aprobada");
  await api.revisar([id], "rechazada", "No se lee");
  expect(llamadas.map((l) => l.cuerpo)).toEqual([
    { justificacionIds: [id], decision: "aprobada" },
    { justificacionIds: [id], decision: "rechazada", motivo: "No se lee" },
  ]);
});

test("RNF-403: pide la URL temporal de la evidencia de una justificación", async () => {
  const { cliente, llamadas } = clienteDoble({ [`GET /justificaciones/${id}/evidencia`]: { url: "https://x", urls: ["https://x"], expiraEn: "2026-11-12T20:00:00.000Z" } });
  expect((await crearClienteJustificaciones(cliente).evidencia(id)).url).toBe("https://x");
  expect(llamadas[0].ruta).toBe(`/justificaciones/${id}/evidencia`);
});

test("RF-406: propaga el error 429 del servidor sin tragarlo", async () => {
  const cliente: ClienteHttpJustificaciones = {
    solicitar: async () => {
      throw Object.assign(new Error("limite_excedido"), { estado: 429, codigo: "limite_excedido" });
    },
  };
  await expect(crearClienteJustificaciones(cliente).bandeja()).rejects.toMatchObject({ estado: 429 });
});
