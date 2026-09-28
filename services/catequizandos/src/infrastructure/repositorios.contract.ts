import { describe, expect, it } from "vitest";
import { Catequizando } from "../domain/catequizando";
import type { CatequizandoRepository } from "../domain/catequizando-repository";
import type { GrupoRepository } from "../domain/grupo-repository";
import { CatequizandoRepositoryEnMemoria } from "./catequizando-repository-en-memoria";
import { CatequizandoRepositorySqlite } from "./catequizando-repository-sqlite";
import { GrupoRepositoryEnMemoria } from "./grupo-repository-en-memoria";
import { GrupoRepositorySqlite } from "./grupo-repository-sqlite";
import { GRUPOS_SEMILLA, crearCatequizandosSemilla } from "./semilla";
import { abrirBaseSqlite } from "./sqlite";

export const AHORA_CONTRATO = new Date("2026-09-28T12:00:00Z");

export type Repositorios = { grupos: GrupoRepository; catequizandos: CatequizandoRepository };

/** Cada fábrica devuelve repositorios nuevos, ya con la semilla del SPEC. */
export type FabricaDeRepositorios = () => Promise<Repositorios>;

export const fabricaEnMemoria: FabricaDeRepositorios = async () => ({
  grupos: new GrupoRepositoryEnMemoria(GRUPOS_SEMILLA),
  catequizandos: new CatequizandoRepositoryEnMemoria(crearCatequizandosSemilla(AHORA_CONTRATO)),
});

export const fabricaSqlite: FabricaDeRepositorios = async () => {
  const db = abrirBaseSqlite(":memory:");
  const grupos = new GrupoRepositorySqlite(db);
  const catequizandos = new CatequizandoRepositorySqlite(db);
  grupos.sembrar(GRUPOS_SEMILLA);
  await catequizandos.sembrarSiVacio(crearCatequizandosSemilla(AHORA_CONTRATO));
  return { grupos, catequizandos };
};

export const nuevoCatequizando = (id: string, ahora = AHORA_CONTRATO) =>
  Catequizando.inscribir(
    {
      id,
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
    },
    { ahora, grupoExiste: true },
  );

/**
 * Contrato que toda implementación de los repositorios debe cumplir (principio de Liskov):
 * las mismas pruebas corren contra memoria y contra SQLite.
 */
export function contratoDeRepositorios(nombre: string, fabrica: FabricaDeRepositorios): void {
  describe(`contrato de repositorios: ${nombre}`, () => {
    it("los grupos traen la semilla en orden y existe() los distingue", async () => {
      const { grupos } = await fabrica();
      expect(await grupos.listar()).toEqual(GRUPOS_SEMILLA);
      expect(await grupos.existe("grp-11-13-m")).toBe(true);
      expect(await grupos.existe("grp-99")).toBe(false);
    });

    it("lista los 12 catequizandos de la semilla en orden y filtra por grupo", async () => {
      const { catequizandos } = await fabrica();
      const todos = await catequizandos.listar();
      expect(todos.map((c) => c.id)).toEqual(
        Array.from({ length: 12 }, (_, i) => `cat-${String(i + 1).padStart(3, "0")}`),
      );
      expect((await catequizandos.listar({ grupoId: "grp-8" })).map((c) => c.id)).toEqual([
        "cat-001",
        "cat-002",
        "cat-003",
      ]);
      expect(await catequizandos.listar({ grupoId: "grp-99" })).toEqual([]);
    });

    it("obtener devuelve el agregado completo, o undefined si no existe", async () => {
      const { catequizandos } = await fabrica();
      const esperado = crearCatequizandosSemilla(AHORA_CONTRATO)[2]!.aDetalle();
      expect((await catequizandos.obtener("cat-003"))?.aDetalle()).toEqual(esperado);
      expect(await catequizandos.obtener("cat-999")).toBeUndefined();
    });

    it("guardar persiste un catequizando nuevo con el siguiente id", async () => {
      const { catequizandos } = await fabrica();
      const id = catequizandos.siguienteId();
      expect(id).toBe("cat-013");
      const nuevo = nuevoCatequizando(id);
      await catequizandos.guardar(nuevo);
      expect((await catequizandos.obtener(id))?.aDetalle()).toEqual(nuevo.aDetalle());
      expect(catequizandos.siguienteId()).toBe("cat-014");
      const lista = await catequizandos.listar();
      expect(lista).toHaveLength(13);
      expect(lista.at(-1)?.id).toBe("cat-013");
    });

    it("guardar dos veces el mismo id no duplica", async () => {
      const { catequizandos } = await fabrica();
      const nuevo = nuevoCatequizando("cat-013");
      await catequizandos.guardar(nuevo);
      await catequizandos.guardar(nuevo);
      expect(await catequizandos.listar()).toHaveLength(13);
    });

    it("un catequizando ya guardado se sigue leyendo aunque hoy ya no cumpla la edad de inscripción", async () => {
      const { catequizandos } = await fabrica();
      const cat = await catequizandos.obtener("cat-010"); // 13 años en 2026
      const en2030 = new Date("2030-01-01T00:00:00Z");
      expect(cat?.aResumen(en2030).edad).toBeGreaterThan(13);
    });
  });
}
