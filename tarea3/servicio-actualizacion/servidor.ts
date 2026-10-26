// Servidor gRPC de actualización de SIGECAT (spec 009, RF-903).
// Implementa contratos/sigecat.proto en puerto 50051 con interceptor de auth (RF-906).

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verificarToken, puedeEscribir, type TokenPayload } from '../compartido/auth.ts';
import { pool } from '../compartido/bd.ts';

if (!process.env.PGPASSWORD) {
  process.env.PGPASSWORD = 'postgres';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RUTA_PROTO = join(__dirname, '..', 'contratos', 'sigecat.proto');
const RUTA_SALUD = join(__dirname, 'salud.proto');

export interface ServidorConfig {
  puerto?: number;
  host?: string;
}

// Carga de definiciones gRPC
const definicionActualizacion = protoLoader.loadSync(RUTA_PROTO, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const definicionSalud = protoLoader.loadSync(RUTA_SALUD, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const paqueteActualizacion = grpc.loadPackageDefinition(definicionActualizacion) as any;
const paqueteSalud = grpc.loadPackageDefinition(definicionSalud) as any;

const ServicioActualizacion = paqueteActualizacion.sigecat.actualizacion.v1.Actualizacion.service;
const ServicioSalud = paqueteSalud.grpc.health.v1.Health.service;

export interface ContextoAutenticado {
  token: string;
  autor: TokenPayload;
}

// Interceptor / validador de metadata "authorization" (RF-906).
export async function validarAutenticacion(metadata: grpc.Metadata, requiereEscritura = true): Promise<ContextoAutenticado> {
  const encabezados = metadata.get('authorization');
  if (!encabezados || encabezados.length === 0) {
    const error = new Error('no_autenticado: falta metadata authorization') as any;
    error.code = grpc.status.PERMISSION_DENIED;
    throw error;
  }

  const raw = String(encabezados[0]);
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();

  let autor: TokenPayload;
  try {
    autor = await verificarToken(token);
  } catch (err: any) {
    const error = new Error(`token_invalido: ${err.message}`) as any;
    error.code = grpc.status.PERMISSION_DENIED;
    throw error;
  }

  if (requiereEscritura && !puedeEscribir(autor.rol)) {
    const error = new Error('fuera_de_alcance: el rol SUP no puede escribir') as any;
    error.code = grpc.status.PERMISSION_DENIED;
    throw error;
  }

  return { token, autor };
}

// Verifica si un catequista tiene alcance sobre un catequizando dado su id
export async function validarAlcanceCatequizando(autor: TokenPayload, catequizandoId: string): Promise<{ catequizandoId: string; grupoId: string; identidadOperativa: string }> {
  const res = await pool.query(
    'SELECT id, grupo_id, identidad_operativa FROM demo_tarea3.catequizando WHERE id = $1',
    [catequizandoId]
  );
  if (res.rowCount === 0) {
    const error = new Error('no_encontrado: el catequizando no existe') as any;
    error.code = grpc.status.NOT_FOUND;
    throw error;
  }
  const fila = res.rows[0];
  if (autor.rol === 'CAT') {
    if (!autor.grupoId || autor.grupoId !== fila.grupo_id) {
      const error = new Error('fuera_de_alcance: el catequizando no pertenece a su grupo') as any;
      error.code = grpc.status.PERMISSION_DENIED;
      throw error;
    }
  } else if (autor.rol === 'FAM') {
    const error = new Error('fuera_de_alcance: el rol FAM no puede escribir asistencia') as any;
    error.code = grpc.status.PERMISSION_DENIED;
    throw error;
  }
  return { catequizandoId: fila.id, grupoId: fila.grupo_id, identidadOperativa: fila.identidad_operativa };
}

// Servicio de salud gRPC
const manejadoresSalud = {
  Check: (_call: any, callback: any) => {
    callback(null, { status: 'SERVING' });
  },
  Watch: (call: any) => {
    call.write({ status: 'SERVING' });
  },
};

// Implementación de Actualizacion (stubs para T009-31, se implementan en T009-32..36)
const manejadoresActualizacion = {
  RegistrarAsistencia: async (call: any, callback: any) => {
    try {
      await validarAutenticacion(call.metadata, true);
      callback({ code: grpc.status.UNIMPLEMENTED, message: 'RegistrarAsistencia se implementa en T009-32' });
    } catch (error: any) {
      callback({ code: error.code ?? grpc.status.INTERNAL, message: error.message });
    }
  },
  RegistrarAsistenciaLote: async (call: any, callback: any) => {
    try {
      await validarAutenticacion(call.metadata, true);
      callback({ code: grpc.status.UNIMPLEMENTED, message: 'RegistrarAsistenciaLote se implementa en T009-33' });
    } catch (error: any) {
      callback({ code: error.code ?? grpc.status.INTERNAL, message: error.message });
    }
  },
  RegistrarJustificacion: async (call: any, callback: any) => {
    try {
      await validarAutenticacion(call.metadata, true);
      callback({ code: grpc.status.UNIMPLEMENTED, message: 'RegistrarJustificacion se implementa en T009-34' });
    } catch (error: any) {
      callback({ code: error.code ?? grpc.status.INTERNAL, message: error.message });
    }
  },
  RecalcularRiesgo: async (call: any, callback: any) => {
    try {
      await validarAutenticacion(call.metadata, true);
      callback({ code: grpc.status.UNIMPLEMENTED, message: 'RecalcularRiesgo se implementa en T009-35' });
    } catch (error: any) {
      callback({ code: error.code ?? grpc.status.INTERNAL, message: error.message });
    }
  },
  ObservarAsistencia: async (call: any) => {
    try {
      await validarAutenticacion(call.metadata, false);
      call.emit('error', { code: grpc.status.UNIMPLEMENTED, message: 'ObservarAsistencia se implementa en T009-36' });
    } catch (error: any) {
      call.emit('error', { code: error.code ?? grpc.status.INTERNAL, message: error.message });
    }
  },
};

export class ServidorActualizacion {
  private servidor: grpc.Server;
  private puertoAsignado: number = 0;
  private iniciado = false;

  constructor(manejadoresPersonalizados?: Partial<typeof manejadoresActualizacion>) {
    this.servidor = new grpc.Server();
    const manejadoresCombinados = { ...manejadoresActualizacion, ...manejadoresPersonalizados };
    this.servidor.addService(ServicioActualizacion, manejadoresCombinados);
    this.servidor.addService(ServicioSalud, manejadoresSalud);
  }

  public iniciar(config: ServidorConfig = {}): Promise<number> {
    const host = config.host ?? '0.0.0.0';
    const puerto = config.puerto ?? 50051;
    const direccion = `${host}:${puerto}`;

    return new Promise((resolve, reject) => {
      this.servidor.bindAsync(direccion, grpc.ServerCredentials.createInsecure(), (error, puertoFinal) => {
        if (error) {
          reject(error);
          return;
        }
        this.puertoAsignado = puertoFinal;
        this.iniciado = true;
        resolve(puertoFinal);
      });
    });
  }

  public detener(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.iniciado) {
        resolve();
        return;
      }
      this.servidor.tryShutdown((err) => {
        if (err) {
          this.servidor.forceShutdown();
        }
        this.iniciado = false;
        resolve();
      });
    });
  }

  public obtenerPuerto(): number {
    return this.puertoAsignado;
  }
}

export async function verificarSalud(puerto = 50051, host = '127.0.0.1'): Promise<{ status: string }> {
  return new Promise((resolve, reject) => {
    const ClienteSalud = paqueteSalud.grpc.health.v1.Health;
    const cliente = new ClienteSalud(`${host}:${puerto}`, grpc.credentials.createInsecure());
    cliente.Check({ service: '' }, (error: any, respuesta: any) => {
      cliente.close();
      if (error) reject(error);
      else resolve(respuesta);
    });
  });
}
