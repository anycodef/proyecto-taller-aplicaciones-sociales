/**
 * Composition root: el único lugar que conoce las implementaciones concretas.
 * Los casos de uso reciben las interfaces del dominio; aquí se les inyecta la de memoria.
 * ALMACEN=sqlite cambia la implementación sin tocar domain/ ni application/.
 */
import { CalcularRiesgo } from "./application/CalcularRiesgo";
import { ObtenerHistorial } from "./application/ObtenerHistorial";
import { PasarLista } from "./application/PasarLista";
import { relojDelSistema } from "./application/Reloj";
import { abrirBaseSqlite } from "./infrastructure/baseSqlite";
import { RegistroRepositorio } from "./domain/RegistroRepositorio";
import { SesionRepositorio } from "./domain/SesionRepositorio";
import { RegistroRepositorioEnMemoria } from "./infrastructure/RegistroRepositorioEnMemoria";
import { RegistroRepositorioSqlite } from "./infrastructure/RegistroRepositorioSqlite";
import { SesionRepositorioEnMemoria } from "./infrastructure/SesionRepositorioEnMemoria";
import { SesionRepositorioSqlite } from "./infrastructure/SesionRepositorioSqlite";
import { sembrar } from "./infrastructure/semilla";
import { crearApp, NOMBRE_SERVICIO } from "./interfaces/http/app";

/** ALMACEN=memoria (por defecto) | sqlite. Es el único lugar que decide la implementación. */
function elegirAlmacen(): { sesiones: SesionRepositorio; registros: RegistroRepositorio; descripcion: string } {
  if (process.env["ALMACEN"] === "sqlite") {
    const ruta = process.env["SQLITE_PATH"] ?? "data/asistencia.db";
    const db = abrirBaseSqlite(ruta);
    return { sesiones: new SesionRepositorioSqlite(db), registros: new RegistroRepositorioSqlite(db), descripcion: `sqlite (${ruta})` };
  }
  return { sesiones: new SesionRepositorioEnMemoria(), registros: new RegistroRepositorioEnMemoria(), descripcion: "memoria" };
}

async function main(): Promise<void> {
  const puerto = Number(process.env["PORT"] ?? 3002);
  const enProduccion = process.env["NODE_ENV"] === "production";

  const { sesiones, registros, descripcion } = elegirAlmacen();
  await sembrar(sesiones, registros);

  const app = crearApp(
    {
      pasarLista: new PasarLista(sesiones, registros, relojDelSistema),
      obtenerHistorial: new ObtenerHistorial(sesiones, registros),
      calcularRiesgo: new CalcularRiesgo(registros, relojDelSistema),
    },
    { habilitarCors: !enProduccion },
  );

  const servidor = app.listen(puerto, () => {
    console.log(`${NOMBRE_SERVICIO} escuchando en :${puerto} (almacén: ${descripcion}; CORS ${enProduccion ? "delegado al gateway" : "habilitado"})`);
  });

  const cerrar = () => servidor.close(() => process.exit(0));
  process.on("SIGTERM", cerrar);
  process.on("SIGINT", cerrar);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
