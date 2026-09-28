import { InscribirCatequizando } from "./application/inscribir-catequizando";
import { ListarCatequizandos } from "./application/listar-catequizandos";
import { ListarGrupos } from "./application/listar-grupos";
import { ObtenerCatequizando } from "./application/obtener-catequizando";
import { CatequizandoRepositoryEnMemoria } from "./infrastructure/catequizando-repository-en-memoria";
import { GrupoRepositoryEnMemoria } from "./infrastructure/grupo-repository-en-memoria";
import { RelojDelSistema } from "./infrastructure/reloj-del-sistema";
import { GRUPOS_SEMILLA, crearCatequizandosSemilla } from "./infrastructure/semilla";
import { crearApp } from "./interfaces/http/app";

// Composition root: único lugar donde se elige la implementación concreta de cada puerto.
const reloj = new RelojDelSistema();
const grupos = new GrupoRepositoryEnMemoria(GRUPOS_SEMILLA);
const catequizandos = new CatequizandoRepositoryEnMemoria(crearCatequizandosSemilla(reloj.ahora()));

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
