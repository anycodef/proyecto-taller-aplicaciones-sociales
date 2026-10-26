// Cliente gRPC de ayuda para pruebas y consumo interno del servicio de actualización.
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RUTA_PROTO = join(__dirname, '..', 'contratos', 'sigecat.proto');

const definicion = protoLoader.loadSync(RUTA_PROTO, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const paquete = grpc.loadPackageDefinition(definicion) as any;
const ServicioActualizacion = paquete.sigecat.actualizacion.v1.Actualizacion;

export function crearClienteActualizacion(direccion = '127.0.0.1:50051'): any {
  return new ServicioActualizacion(direccion, grpc.credentials.createInsecure());
}

export function crearMetadata(token?: string): grpc.Metadata {
  const metadata = new grpc.Metadata();
  if (token) {
    metadata.set('authorization', `Bearer ${token}`);
  }
  return metadata;
}

// Espera a que el cliente gRPC esté listo para recibir llamadas con reintentos
export function esperarConexion(cliente: any, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    cliente.waitForReady(deadline, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
