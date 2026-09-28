import { describe, expect, it } from "vitest";
import { CatequizandoRepositorySqlite } from "./catequizando-repository-sqlite";
import {
  AHORA_CONTRATO,
  contratoDeRepositorios,
  fabricaEnMemoria,
  fabricaSqlite,
  nuevoCatequizando,
} from "./repositorios.contract";
import { crearCatequizandosSemilla } from "./semilla";
import { abrirBaseSqlite } from "./sqlite";

contratoDeRepositorios("en memoria", fabricaEnMemoria);
contratoDeRepositorios("SQLite", fabricaSqlite);

describe("SQLite: persistencia entre reinicios", () => {
  it("una segunda instancia sobre la misma base conserva los datos, no re-siembra y sigue la numeración", async () => {
    const db = abrirBaseSqlite(":memory:");
    const primera = new CatequizandoRepositorySqlite(db);
    await primera.sembrarSiVacio(crearCatequizandosSemilla(AHORA_CONTRATO));
    await primera.guardar(nuevoCatequizando(primera.siguienteId()));

    const segunda = new CatequizandoRepositorySqlite(db);
    await segunda.sembrarSiVacio(crearCatequizandosSemilla(AHORA_CONTRATO));
    expect(await segunda.listar()).toHaveLength(13);
    expect(segunda.siguienteId()).toBe("cat-014");
  });
});
