import { InscribirCatequizando } from "./application/inscribir-catequizando";
import { ListarCatequizandos } from "./application/listar-catequizandos";
import { ListarGrupos } from "./application/listar-grupos";
import { ObtenerCatequizando } from "./application/obtener-catequizando";
import type { CatequizandoRepository } from "./domain/catequizando-repository";
import type { GrupoRepository } from "./domain/grupo-repository";
import { CatequizandoRepositoryEnMemoria } from "./infrastructure/catequizando-repository-en-memoria";
import { CatequizandoRepositorySqlite } from "./infrastructure/catequizando-repository-sqlite";
import { GrupoRepositoryEnMemoria } from "./infrastructure/grupo-repository-en-memoria";
import { GrupoRepositorySqlite } from "./infrastructure/grupo-repository-sqlite";
import { RelojDelSistema } from "./infrastructure/reloj-del-sistema";
import { GRUPOS_SEMILLA, crearCatequizandosSemilla } from "./infrastructure/semilla";
import { abrirBaseSqlite } from "./infrastructure/sqlite";
import { crearApp } from "./interfaces/http/app";

// Composition root: único lugar donde se elige la implementación concreta de cada puerto.
const reloj = new RelojDelSistema();
const semilla = crearCatequizandosSemilla(reloj.ahora());

async function crearRepositorios(): Promise<{ grupos: GrupoRepository; catequizandos: CatequizandoRepository }> {
  // ALMACEN=sqlite activa la persistencia; por defecto (memoria) queda con la semilla.
  if (process.env.ALMACEN === "sqlite") {
    const db = abrirBaseSqlite(process.env.SQLITE_PATH ?? "data/catequizandos.db");
    const grupos = new GrupoRepositorySqlite(db);
    const catequizandos = new CatequizandoRepositorySqlite(db);
    grupos.sembrar(GRUPOS_SEMILLA);
    await catequizandos.sembrarSiVacio(semilla);
    return { grupos, catequizandos };
  }
  return {
    grupos: new GrupoRepositoryEnMemoria(GRUPOS_SEMILLA),
    catequizandos: new CatequizandoRepositoryEnMemoria(semilla),
  };
}

async function main(): Promise<void> {
  const { grupos, catequizandos } = await crearRepositorios();

  const app = crearApp(
    {
      listarGrupos: new ListarGrupos(grupos),
      listarCatequizandos: new ListarCatequizandos(catequizandos, reloj),
      obtenerCatequizando: new ObtenerCatequizando(catequizandos),
      inscribirCatequizando: new InscribirCatequizando(catequizandos, grupos, reloj),
    },
    { habilitarCors: process.env.NODE_ENV !== "production" },
  );

  const puerto = Number(process.env.PORT ?? 3001);
  app.listen(puerto, () => {
    console.log(`Catequizandos escuchando en el puerto ${puerto}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
