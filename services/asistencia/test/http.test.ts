import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { CalcularRiesgo } from "../src/application/CalcularRiesgo";
import { ObtenerHistorial } from "../src/application/ObtenerHistorial";
import { PasarLista } from "../src/application/PasarLista";
import { RegistroRepositorioEnMemoria } from "../src/infrastructure/RegistroRepositorioEnMemoria";
import { SesionRepositorioEnMemoria } from "../src/infrastructure/SesionRepositorioEnMemoria";
import { sembrar } from "../src/infrastructure/semilla";
import { crearApp } from "../src/interfaces/http/app";

async function levantar(habilitarCors: boolean): Promise<{ servidor: Server; base: string }> {
  const sesiones = new SesionRepositorioEnMemoria();
  const registros = new RegistroRepositorioEnMemoria();
  await sembrar(sesiones, registros);
  const reloj = () => new Date("2026-09-28T12:00:00.000Z");
  const app = crearApp(
    {
      pasarLista: new PasarLista(sesiones, registros, reloj),
      obtenerHistorial: new ObtenerHistorial(sesiones, registros),
      calcularRiesgo: new CalcularRiesgo(registros, reloj),
    },
    { habilitarCors },
  );
  const servidor = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { servidor, base: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}` };
}

const enviar = (base: string, ruta: string, cuerpo: unknown) =>
  fetch(`${base}${ruta}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });

const pase = {
  sesion: { id: "ses-http-1", grupoId: "grp-8", fecha: "2026-09-28", tipo: "catequesis", tema: "Demo" },
  registros: [
    { id: "reg-http-1", catequizandoId: "cat-001", estado: "presente" },
    { id: "reg-http-2", catequizandoId: "cat-003", estado: "ausente" },
  ],
  registradoPor: "C1",
};

describe("HTTP — contrato de Asistencia", () => {
  let servidor: Server;
  let base: string;
  before(async () => ({ servidor, base } = await levantar(true)));
  after(() => servidor.close());

  it("GET /health → 200 {status, servicio}", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok", servicio: "asistencia" });
  });

  it("GET /catequizandos/:id/riesgo → SenalRiesgo de la semilla", async () => {
    const res = await fetch(`${base}/catequizandos/cat-007/riesgo`);
    assert.equal(res.status, 200);
    const senal = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(senal).sort(), ["calculadoEn", "catequizandoId", "motivos", "nivel"]);
    assert.equal(senal["nivel"], "alto");
    assert.equal(senal["catequizandoId"], "cat-007");
  });

  it("riesgos de la semilla: cat-003 medio, cat-007 alto, cat-005 y cat-002 bajo", async () => {
    const niveles: Record<string, string> = {};
    for (const id of ["cat-003", "cat-007", "cat-005", "cat-002"]) {
      niveles[id] = ((await (await fetch(`${base}/catequizandos/${id}/riesgo`)).json()) as { nivel: string }).nivel;
    }
    assert.deepEqual(niveles, { "cat-003": "medio", "cat-007": "alto", "cat-005": "bajo", "cat-002": "bajo" });
  });

  it("GET /catequizandos/:id/registros → [{fecha, tipo, estado}]", async () => {
    const res = await fetch(`${base}/catequizandos/cat-002/registros`);
    assert.equal(res.status, 200);
    const historial = (await res.json()) as Array<Record<string, string>>;
    assert.equal(historial.length, 8);
    assert.deepEqual(Object.keys(historial[0]!).sort(), ["estado", "fecha", "tipo"]);
  });

  it("catequizando desconocido: 200 con historial vacío y riesgo bajo (no se verifica existencia)", async () => {
    assert.deepEqual(await (await fetch(`${base}/catequizandos/cat-999/registros`)).json(), []);
    assert.equal(((await (await fetch(`${base}/catequizandos/cat-999/riesgo`)).json()) as { nivel: string }).nivel, "bajo");
  });

  it("POST /pases-de-lista → 201 y el riesgo cambia; reenviar no duplica", async () => {
    const antes = ((await (await fetch(`${base}/catequizandos/cat-003/riesgo`)).json()) as { nivel: string }).nivel;
    assert.equal(antes, "medio");

    const res = await enviar(base, "/pases-de-lista", pase);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { sesionId: "ses-http-1", registrosGuardados: 2 });

    const reenvio = await enviar(base, "/pases-de-lista", pase);
    assert.equal(reenvio.status, 201);

    const historial = (await (await fetch(`${base}/catequizandos/cat-003/registros`)).json()) as unknown[];
    assert.equal(historial.length, 9);
    const despues = (await (await fetch(`${base}/catequizandos/cat-003/riesgo`)).json()) as { nivel: string; motivos: string[] };
    assert.equal(despues.nivel, "alto");
    assert.equal(despues.motivos[0], "3 ausencias sin justificar");
  });

  it("POST inválido → 400 con el error estándar", async () => {
    for (const cuerpo of [
      {},
      { ...pase, registradoPor: "" },
      { ...pase, registros: [] },
      { ...pase, registros: [{ id: "x", catequizandoId: "cat-001", estado: "dormido" }] },
      { ...pase, sesion: { ...pase.sesion, tipo: "retiro" } },
      { ...pase, sesion: "no-objeto" },
    ]) {
      const res = await enviar(base, "/pases-de-lista", cuerpo);
      assert.equal(res.status, 400, JSON.stringify(cuerpo));
      const error = (await res.json()) as { error: { code: string; message: string } };
      assert.equal(error.error.code, "VALIDACION");
      assert.ok(error.error.message.length > 0);
    }
  });

  it("JSON malformado → 400 VALIDACION", async () => {
    const res = await fetch(`${base}/pases-de-lista`, { method: "POST", headers: { "content-type": "application/json" }, body: "{no es json" });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "VALIDACION");
  });

  it("ruta inexistente → 404 NO_ENCONTRADO", async () => {
    const res = await fetch(`${base}/no-existe`);
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "NO_ENCONTRADO");
  });

  it("con CORS habilitado (desarrollo) responde Access-Control-Allow-Origin", async () => {
    const res = await fetch(`${base}/health`, { headers: { origin: "http://localhost:5500" } });
    assert.ok(res.headers.get("access-control-allow-origin"));
  });
});

describe("HTTP — producción", () => {
  it("sin CORS propio: el gateway es quien lo maneja", async () => {
    const { servidor, base } = await levantar(false);
    try {
      const res = await fetch(`${base}/health`, { headers: { origin: "http://localhost:5500" } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    } finally {
      servidor.close();
    }
  });
});
