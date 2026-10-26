// Servidor gRPC doble para las pruebas de P2 (plan §2: «P2 simula el cliente
// gRPC»).
//
// Es un servidor gRPC de verdad, cargado del mismo contrato congelado, no un
// objeto que finge ser el cliente: asi se comprueba lo que de verdad puede
// romperse — los nombres de campo del proto, los enums y el viaje de la
// metadata `authorization` — en vez de comprobar un doble a medida.

import * as grpc from '@grpc/grpc-js';
import { cargarServicioActualizacion } from '../cliente-grpc.ts';

export interface LlamadaRegistrada {
  metodo: string;
  solicitud: Record<string, unknown>;
  autorizacion: string | null;
}

export interface RespuestasDoble {
  RegistrarAsistencia?: (solicitud: Record<string, unknown>) => unknown;
  RegistrarJustificacion?: (solicitud: Record<string, unknown>) => unknown;
  RecalcularRiesgo?: (solicitud: Record<string, unknown>) => unknown;
}

export interface DobleGrpc {
  direccion: string;
  llamadas: LlamadaRegistrada[];
  ultima: () => LlamadaRegistrada | undefined;
  cerrar: () => Promise<void>;
}

// Un error con `code` de gRPC: es asi como lo manda P3 en su servidor.
export function errorGrpc(code: grpc.status, message: string): grpc.ServiceError {
  return Object.assign(new Error(message), { code, details: message }) as grpc.ServiceError;
}

const RESPUESTAS_PREDETERMINADAS: Required<RespuestasDoble> = {
  RegistrarAsistencia: (solicitud) => ({ id: solicitud.id, repetido: false }),
  RegistrarJustificacion: (solicitud) => ({ id: solicitud.id, repetido: false }),
  RecalcularRiesgo: (solicitud) => ({
    catequizando_id: solicitud.catequizando_id,
    nivel: 'MEDIO',
    motivo: '2 faltas consecutivas sin justificar',
    calculado_en: '2026-11-09T10:00:00.000Z',
  }),
};

export async function levantarDobleGrpc(respuestas: RespuestasDoble = {}): Promise<DobleGrpc> {
  const llamadas: LlamadaRegistrada[] = [];
  const Servicio = cargarServicioActualizacion();
  const servidor = new grpc.Server();

  function unario(metodo: keyof RespuestasDoble) {
    return (
      llamada: grpc.ServerUnaryCall<Record<string, unknown>, unknown>,
      callback: grpc.sendUnaryData<unknown>
    ) => {
      const autorizacion = llamada.metadata.get('authorization')[0];
      llamadas.push({
        metodo,
        solicitud: llamada.request,
        autorizacion: autorizacion === undefined ? null : String(autorizacion),
      });
      const responder = respuestas[metodo] ?? RESPUESTAS_PREDETERMINADAS[metodo];
      try {
        callback(null, responder(llamada.request));
      } catch (error) {
        callback(error as grpc.ServiceError, null);
      }
    };
  }

  const noImplementado = (_llamada: unknown, callback: grpc.sendUnaryData<unknown>) => {
    callback(errorGrpc(grpc.status.UNIMPLEMENTED, 'el doble no implementa este metodo'), null);
  };

  servidor.addService(Servicio.service, {
    RegistrarAsistencia: unario('RegistrarAsistencia'),
    RegistrarJustificacion: unario('RegistrarJustificacion'),
    RecalcularRiesgo: unario('RecalcularRiesgo'),
    // P2 no las usa; estan para que grpc-js no avise de metodos sin manejador.
    RegistrarAsistenciaLote: noImplementado,
    ObservarAsistencia: (llamada: grpc.ServerWritableStream<unknown, unknown>) => {
      llamada.emit(
        'error',
        errorGrpc(grpc.status.UNIMPLEMENTED, 'el doble no implementa este metodo')
      );
    },
  } as grpc.UntypedServiceImplementation);

  const puerto = await new Promise<number>((resolver, rechazar) => {
    servidor.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, puerto) => {
      if (error) rechazar(error);
      else resolver(puerto);
    });
  });

  return {
    direccion: `127.0.0.1:${puerto}`,
    llamadas,
    ultima: () => llamadas[llamadas.length - 1],
    cerrar: () =>
      new Promise<void>((resolver) => {
        servidor.tryShutdown(() => resolver());
      }),
  };
}
