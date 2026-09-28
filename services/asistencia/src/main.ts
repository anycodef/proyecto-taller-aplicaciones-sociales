/**
 * Composition root: el único lugar que conoce las implementaciones concretas.
 * Los casos de uso reciben las interfaces del dominio; aquí se les inyecta la de memoria.
 * Para pasar a SQLite basta con cambiar las dos líneas de repositorios.
 */
import { CalcularRiesgo } from "./application/CalcularRiesgo";
import { ObtenerHistorial } from "./application/ObtenerHistorial";
import { PasarLista } from "./application/PasarLista";
import { relojDelSistema } from "./application/Reloj";
import { RegistroRepositorioEnMemoria } from "./infrastructure/RegistroRepositorioEnMemoria";
import { SesionRepositorioEnMemoria } from "./infrastructure/SesionRepositorioEnMemoria";
import { sembrar } from "./infrastructure/semilla";
import { crearApp, NOMBRE_SERVICIO } from "./interfaces/http/app";

async function main(): Promise<void> {
  const puerto = Number(process.env["PORT"] ?? 3002);
  const enProduccion = process.env["NODE_ENV"] === "production";

  const sesiones = new SesionRepositorioEnMemoria();
  const registros = new RegistroRepositorioEnMemoria();
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
    console.log(`${NOMBRE_SERVICIO} escuchando en :${puerto} (CORS ${enProduccion ? "delegado al gateway" : "habilitado"})`);
  });

  const cerrar = () => servidor.close(() => process.exit(0));
  process.on("SIGTERM", cerrar);
  process.on("SIGINT", cerrar);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
