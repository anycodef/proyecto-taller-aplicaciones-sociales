import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InscribirCatequizando } from "../../application/inscribir-catequizando";
import { ListarCatequizandos } from "../../application/listar-catequizandos";
import { ListarGrupos } from "../../application/listar-grupos";
import { ObtenerCatequizando } from "../../application/obtener-catequizando";
import {
  AHORA_CONTRATO as AHORA,
  fabricaEnMemoria,
  fabricaSqlite,
} from "../../infrastructure/repositorios.contract";
import { crearApp } from "./app";

const inscripcionValida = {
  grupoId: "grp-9",
  nombres: "Nuevo",
  apellidos: "Ficticio",
  fechaNacimiento: "2017-03-10",
  consentimiento: {
    otorgadoPor: "Apoderado ficticio",
    otorgadoEn: "2026-09-20T10:00:00Z",
    version: "v1",
    retencionHasta: "2029-09-20",
  },
};

// El mismo contrato HTTP corre contra ambas implementaciones de los repositorios.
describe.each([
  ["en memoria", fabricaEnMemoria],
  ["SQLite", fabricaSqlite],
])("contrato HTTP (%s)", (_nombre, fabrica) => {
  let servidor: Server;
  let base: string;

  beforeAll(async () => {
    const reloj = { ahora: () => AHORA };
    const { grupos, catequizandos } = await fabrica();
    const app = crearApp(
      {
        listarGrupos: new ListarGrupos(grupos),
        listarCatequizandos: new ListarCatequizandos(catequizandos, reloj),
        obtenerCatequizando: new ObtenerCatequizando(catequizandos),
        inscribirCatequizando: new InscribirCatequizando(catequizandos, grupos, reloj),
      },
      { habilitarCors: false },
    );
    await new Promise<void>((ok) => {
      servidor = app.listen(0, () => ok());
    });
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((ok) => servidor.close(() => ok())));

  const post = (cuerpo: unknown) =>
    fetch(`${base}/catequizandos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

  it("GET /health", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", servicio: "catequizandos" });
  });

  it("GET /grupos devuelve los 5 grupos de la semilla", async () => {
    const grupos = (await (await fetch(`${base}/grupos`)).json()) as { id: string; cicloId: string }[];
    expect(grupos.map((g) => g.id)).toEqual(["grp-8", "grp-9", "grp-10", "grp-11-13-h", "grp-11-13-m"]);
    expect(grupos.every((g) => g.cicloId === "ciclo-2026")).toBe(true);
  });

  it("GET /catequizandos?grupoId= devuelve el listado mínimo", async () => {
    const lista = (await (await fetch(`${base}/catequizandos?grupoId=grp-8`)).json()) as Record<string, unknown>[];
    expect(lista.map((c) => c.id)).toEqual(["cat-001", "cat-002", "cat-003"]);
    for (const c of lista) {
      expect(Object.keys(c).sort()).toEqual(["apellidos", "edad", "grupoId", "id", "nombres"]);
      expect(c.edad).toBe(8);
    }
  });

  it("la semilla reparte cat-001..cat-012 en los grupos del SPEC", async () => {
    const lista = (await (await fetch(`${base}/catequizandos`)).json()) as { id: string; grupoId: string }[];
    expect(lista.map((c) => [c.id, c.grupoId])).toEqual([
      ["cat-001", "grp-8"],
      ["cat-002", "grp-8"],
      ["cat-003", "grp-8"],
      ["cat-004", "grp-9"],
      ["cat-005", "grp-9"],
      ["cat-006", "grp-10"],
      ["cat-007", "grp-10"],
      ["cat-008", "grp-11-13-h"],
      ["cat-009", "grp-11-13-h"],
      ["cat-010", "grp-11-13-h"],
      ["cat-011", "grp-11-13-m"],
      ["cat-012", "grp-11-13-m"],
    ]);
  });

  it("GET /catequizandos/:id devuelve el detalle con consentimiento", async () => {
    const res = await fetch(`${base}/catequizandos/cat-003`);
    expect(res.status).toBe(200);
    const detalle = (await res.json()) as Record<string, unknown>;
    expect(detalle.id).toBe("cat-003");
    expect(detalle).toHaveProperty("fechaNacimiento");
    expect(detalle).toHaveProperty("consentimiento.otorgadoPor");
    expect(detalle.apoderadoIds).toEqual([]);
  });

  it("GET /catequizandos/:id inexistente → 404 NO_ENCONTRADO", async () => {
    const res = await fetch(`${base}/catequizandos/cat-999`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("NO_ENCONTRADO");
  });

  it("POST /catequizandos inscribe y queda disponible", async () => {
    const res = await post(inscripcionValida);
    expect(res.status).toBe(201);
    const creado = (await res.json()) as { id: string };
    expect(creado.id).toBe("cat-013");
    expect((await fetch(`${base}/catequizandos/${creado.id}`)).status).toBe(200);
  });

  it("POST sin consentimiento → 400 VALIDACION y no se guarda nada", async () => {
    const { consentimiento: _c, ...sinConsentimiento } = inscripcionValida;
    const antes = ((await (await fetch(`${base}/catequizandos`)).json()) as unknown[]).length;
    const res = await post(sinConsentimiento);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDACION");
    const despues = ((await (await fetch(`${base}/catequizandos`)).json()) as unknown[]).length;
    expect(despues).toBe(antes);
  });

  it("POST con grupo inexistente, edad fuera de rango o cuerpo inválido → 400", async () => {
    expect((await post({ ...inscripcionValida, grupoId: "grp-99" })).status).toBe(400);
    expect((await post({ ...inscripcionValida, fechaNacimiento: "2000-01-01" })).status).toBe(400);
    expect((await post([])).status).toBe(400);
    const res = await fetch(`${base}/catequizandos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{no es json",
    });
    expect(res.status).toBe(400);
  });

  it("una ruta desconocida → 404 con el error estándar", async () => {
    const res = await fetch(`${base}/no-existe`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("NO_ENCONTRADO");
  });
});
