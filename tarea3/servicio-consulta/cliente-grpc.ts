// Cliente gRPC hacia el servicio de actualizacion de P3 (spec 009, RF-904).
//
// La puerta GraphQL no escribe en PostgreSQL: delega en el contrato binario y
// devuelve lo que responda, sin repetir ninguna regla de negocio. El JWT viaja
// tal cual en la metadata `authorization`, de modo que quien decide los
// permisos de escritura sigue siendo P3 con compartido/auth.ts.

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'node:path';
import type {
  gRPCRecalcularRiesgoSolicitud,
  gRPCRegistrarAsistenciaSolicitud,
  gRPCResultadoEscritura,
  gRPCRiesgo,
} from '../compartido/tipos.ts';

export const RUTA_PROTO = join(import.meta.dirname, '..', 'contratos', 'sigecat.proto');
export const DIRECCION_PREDETERMINADA = '127.0.0.1:50051';

// Mismas opciones que el servidor de P3: si difirieran, los nombres de campo
// dejarian de coincidir con el contrato.
export const OPCIONES_PROTO: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export interface gRPCRegistrarJustificacionSolicitud {
  id: string;
  asistencia_id: string;
  motivo: string;
}

export interface ClienteActualizacion {
  registrarAsistencia: (
    solicitud: gRPCRegistrarAsistenciaSolicitud,
    autorizacion: string | null
  ) => Promise<gRPCResultadoEscritura>;
  registrarJustificacion: (
    solicitud: gRPCRegistrarJustificacionSolicitud,
    autorizacion: string | null
  ) => Promise<gRPCResultadoEscritura>;
  recalcularRiesgo: (
    solicitud: gRPCRecalcularRiesgoSolicitud,
    autorizacion: string | null
  ) => Promise<gRPCRiesgo>;
  cerrar: () => void;
}

export interface OpcionesCliente {
  direccion?: string;
}

export function cargarServicioActualizacion(): grpc.ServiceClientConstructor {
  const definicion = protoLoader.loadSync(RUTA_PROTO, OPCIONES_PROTO);
  const paquete = grpc.loadPackageDefinition(definicion) as unknown as {
    sigecat: { actualizacion: { v1: { Actualizacion: grpc.ServiceClientConstructor } } };
  };
  return paquete.sigecat.actualizacion.v1.Actualizacion;
}

function metadataCon(autorizacion: string | null): grpc.Metadata {
  const metadata = new grpc.Metadata();
  // Se reenvia el valor original, con su «Bearer », para que P3 lo lea igual
  // que si el cliente le hubiera hablado directamente.
  if (autorizacion) metadata.set('authorization', autorizacion);
  return metadata;
}

export function crearClienteGrpc(opciones: OpcionesCliente = {}): ClienteActualizacion {
  const direccion =
    opciones.direccion ?? process.env.DIRECCION_ACTUALIZACION ?? DIRECCION_PREDETERMINADA;
  const Servicio = cargarServicioActualizacion();
  const cliente = new Servicio(direccion, grpc.credentials.createInsecure()) as grpc.Client &
    Record<string, grpc.requestCallback<unknown>>;

  function invocar<TSolicitud, TRespuesta>(
    metodo: string,
    solicitud: TSolicitud,
    autorizacion: string | null
  ): Promise<TRespuesta> {
    return new Promise((resolver, rechazar) => {
      const llamada = cliente[metodo] as unknown as (
        solicitud: TSolicitud,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, respuesta: TRespuesta) => void
      ) => void;
      llamada.call(cliente, solicitud, metadataCon(autorizacion), (error, respuesta) => {
        if (error) rechazar(error);
        else resolver(respuesta);
      });
    });
  }

  return {
    registrarAsistencia: (solicitud, autorizacion) =>
      invocar('RegistrarAsistencia', solicitud, autorizacion),
    registrarJustificacion: (solicitud, autorizacion) =>
      invocar('RegistrarJustificacion', solicitud, autorizacion),
    recalcularRiesgo: (solicitud, autorizacion) =>
      invocar('RecalcularRiesgo', solicitud, autorizacion),
    cerrar: () => cliente.close(),
  };
}
