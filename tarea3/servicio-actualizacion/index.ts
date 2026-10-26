// Punto de entrada del microservicio de actualización gRPC (spec 009, RF-903).
import { ServidorActualizacion } from './servidor.ts';

const puerto = Number(process.env.PUERTO_ACTUALIZACION ?? 50051);
const servidor = new ServidorActualizacion();

async function arrancar() {
  const puertoAsignado = await servidor.iniciar({ puerto });
  console.log(`[servicio-actualizacion] Servidor gRPC escuchando en puerto ${puertoAsignado}`);
}

async function apagar() {
  console.log('[servicio-actualizacion] Apagando servidor gRPC ordenadamente...');
  await servidor.detener();
  process.exit(0);
}

process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);

arrancar().catch((err) => {
  console.error('[servicio-actualizacion] Error al iniciar:', err);
  process.exit(1);
});
