import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { crearClienteHttp } from "@/plataforma/api/cliente";
import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";

function fetchSimulado(respuestas: Record<string, unknown>) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    const clave = `${init.method} ${url.replace("https://api.sigecat.test", "")}`;
    return new Response(JSON.stringify(respuestas[clave] ?? { codigo: "no_encontrado" }), { status: clave in respuestas ? 200 : 404 });
  }) as unknown as typeof fetch;
  return { llamadas, fetchImpl };
}
const http = (fetchImpl: typeof fetch) => crearClienteHttp({ urlBase: "https://api.sigecat.test", obtenerToken: async () => "jwt-familia", renovarSesion: async () => null, irASinAcceso: () => undefined, fetchImpl });

test("RF-401: pide las ausencias justificables con la sesión de familia", async () => {
  const datos = { cicloId: "c", diasPlazo: 7, ninos: [], ausencias: [] };
  const { llamadas, fetchImpl } = fetchSimulado({ "GET /familia/ausencias-justificables": datos, "GET /familia/justificaciones": { justificaciones: [] } });
  const cliente = crearClienteJustificaciones(http(fetchImpl));
  expect(await cliente.ausenciasJustificables()).toEqual(datos);
  expect(await cliente.misJustificaciones()).toEqual([]);
  expect((llamadas[0].init.headers as Record<string, string>).authorization).toBe("Bearer jwt-familia");
});

test("RF-402: envía la reserva y el lote con los cuerpos esperados", async () => {
  const { llamadas, fetchImpl } = fetchSimulado({ "POST /evidencias/reservas": { evidenciaId: "e" }, "POST /justificaciones/lotes": { loteId: "l" } });
  const cliente = crearClienteJustificaciones(http(fetchImpl));
  await cliente.reservarEvidencia("e", [{ orden: 1, bytes: 1000, contentType: "image/jpeg" }]);
  await cliente.crearLote({ loteId: "l", evidenciaId: "e", causa: "salud_nino", ausencias: [{ justificacionId: "j", catequizandoId: "n", sesionId: "s", anticipada: false }] });
  expect(llamadas.map(l => JSON.parse(String(l.init.body)))).toEqual([
    { evidenciaId: "e", archivos: [{ orden: 1, bytes: 1000, contentType: "image/jpeg" }] },
    { loteId: "l", evidenciaId: "e", causa: "salud_nino", ausencias: [{ justificacionId: "j", catequizandoId: "n", sesionId: "s", anticipada: false }] },
  ]);
});

test("RNF-404: el cliente de justificaciones no importa ningún almacenamiento", () => {
  const fuente = readFileSync(resolve(__dirname, "../../../lib/justificaciones/cliente-justificaciones.ts"), "utf8");
  const importaciones = [...fuente.matchAll(/from\s+"([^"]+)"/g)].map(m => m[1]);
  expect(importaciones).toEqual(["./tipos"]);
});
