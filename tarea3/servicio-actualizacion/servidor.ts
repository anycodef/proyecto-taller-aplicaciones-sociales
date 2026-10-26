// Servidor gRPC de actualización de SIGECAT (spec 009, RF-903).
// Implementa contratos/sigecat.proto en puerto 50051 con interceptor de auth (RF-906).

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verificarToken, puedeEscribir, type TokenPayload } from '../compartido/auth.ts';
import { pool, transaccionar } from '../compartido/bd.ts';

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

export function normalizarEstado(estado: any): 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADA' | 'TARDANZA' {
  if (typeof estado === 'string') {
    if (estado === 'PRESENTE' || estado === 'AUSENTE' || estado === 'JUSTIFICADA' || estado === 'TARDANZA') {
      return estado;
    }
    const num = parseInt(estado, 10);
    if (!isNaN(num)) return normalizarEstado(num);
  }
  switch (estado) {
    case 1: return 'PRESENTE';
    case 2: return 'AUSENTE';
    case 3: return 'JUSTIFICADA';
    case 4: return 'TARDANZA';
    default: return 'PRESENTE';
  }
}

export function estadoAProto(estado: string): number {
  switch (estado) {
    case 'PRESENTE': return 1;
    case 'AUSENTE': return 2;
    case 'JUSTIFICADA': return 3;
    case 'TARDANZA': return 4;
    default: return 0;
  }
}

// Implementación de Actualizacion
const manejadoresActualizacion = {
  RegistrarAsistencia: async (call: any, callback: any) => {
    try {
      const { autor } = await validarAutenticacion(call.metadata, true);
      const req = call.request;
      if (!req.id || !req.catequizando_id || !req.fecha) {
        callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Faltan campos obligatorios (id, catequizando_id, fecha)' });
        return;
      }
      const { grupoId, identidadOperativa } = await validarAlcanceCatequizando(autor, req.catequizando_id);
      const estado = normalizarEstado(req.estado);

      const res = await pool.query(
        `INSERT INTO demo_tarea3.asistencia (id, catequizando_id, fecha, estado, registrado_por)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [req.id, req.catequizando_id, req.fecha, estado, autor.identidadOperativa]
      );

      const repetido = (res.rowCount ?? 0) === 0;

      if (!repetido) {
        const evento = JSON.stringify({
          asistencia_id: req.id,
          catequizando_id: req.catequizando_id,
          grupo_id: grupoId,
          identidad_operativa: identidadOperativa,
          estado,
          fecha: req.fecha,
        });
        await pool.query('SELECT pg_notify($1, $2)', ['asistencia_evento', evento]).catch(() => {});
      }

      callback(null, { id: req.id, repetido });
    } catch (error: any) {
      callback({ code: error.code ?? grpc.status.INTERNAL, message: error.message });
    }
  },
  RegistrarAsistenciaLote: async (call: any, callback: any) => {
    let autor: TokenPayload;
    try {
      const auth = await validarAutenticacion(call.metadata, true);
      autor = auth.autor;
    } catch (error: any) {
      callback({ code: error.code ?? grpc.status.INTERNAL, message: error.message });
      return;
    }

    const solicitudes: any[] = [];
    call.on('data', (req: any) => {
      solicitudes.push(req);
    });

    call.on('error', (err: any) => {
      callback({ code: grpc.status.CANCELLED, message: err.message });
    });

    call.on('end', async () => {
      try {
        const resumen = await transaccionar(async (cliente) => {
          let registrados = 0;
          let repetidos = 0;
          let rechazados = 0;
          const eventosNotificar: string[] = [];

          for (const req of solicitudes) {
            if (!req.id || !req.catequizando_id || !req.fecha) {
              rechazados++;
              continue;
            }

            // Validar existencia y alcance del catequizando
            const catRes = await cliente.query(
              'SELECT id, grupo_id, identidad_operativa FROM demo_tarea3.catequizando WHERE id = $1',
              [req.catequizando_id]
            );
            if (catRes.rowCount === 0) {
              rechazados++;
              continue;
            }

            const catFila = catRes.rows[0];
            if (autor.rol === 'CAT' && (!autor.grupoId || autor.grupoId !== catFila.grupo_id)) {
              rechazados++;
              continue;
            }
            if (autor.rol === 'FAM') {
              rechazados++;
              continue;
            }

            let estado: string;
            try {
              estado = normalizarEstado(req.estado);
            } catch {
              rechazados++;
              continue;
            }

            const insertRes = await cliente.query(
              `INSERT INTO demo_tarea3.asistencia (id, catequizando_id, fecha, estado, registrado_por)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO NOTHING
               RETURNING id`,
              [req.id, req.catequizando_id, req.fecha, estado, autor.identidadOperativa]
            );

            if ((insertRes.rowCount ?? 0) > 0) {
              registrados++;
              eventosNotificar.push(
                JSON.stringify({
                  asistencia_id: req.id,
                  catequizando_id: req.catequizando_id,
                  grupo_id: catFila.grupo_id,
                  identidad_operativa: catFila.identidad_operativa,
                  estado,
                  fecha: req.fecha,
                })
              );
            } else {
              repetidos++;
            }
          }

          for (const evento of eventosNotificar) {
            await cliente.query('SELECT pg_notify($1, $2)', ['asistencia_evento', evento]).catch(() => {});
          }

          return { registrados, repetidos, rechazados };
        });

        callback(null, resumen);
      } catch (error: any) {
        callback({ code: error.code ?? grpc.status.INTERNAL, message: error.message });
      }
    });
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
