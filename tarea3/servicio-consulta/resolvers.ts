// Resolvers del contrato de consulta (spec 009, RF-902). Solo presentan: la
// autorizacion vive en compartido/auth.ts y las escrituras se delegan por gRPC
// en el servicio de P3, sin duplicar reglas de negocio (RF-904).

import { puedeLeerGrupo, type TokenPayload } from '../compartido/auth.ts';
import type {
  Asistencia,
  ConexionCatequizandos,
  Contexto,
  FechaCivil,
  Grupo,
  NivelRiesgo,
  ResumenAsistencia,
  Riesgo,
} from '../compartido/tipos.ts';
import type { MapaResolvers } from './esquema.ts';
import {
  errorEntradaInvalida,
  errorFueraDeAlcance,
  exigirToken,
  type ContextoPeticion,
} from './contexto.ts';
import type { FilaCatequizando } from './datos.ts';

// RNF-903: ninguna pagina puede pedir mas de 50 nodos.
export const MAXIMO_POR_PAGINA = 50;

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DependenciasResolvers {
  // El cliente gRPC de las mutaciones se suma en T009-26.
  marcador?: never;
}

function codificarCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

function decodificarCursor(cursor?: string | null): string | null {
  if (cursor === undefined || cursor === null || cursor === '') return null;
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!PATRON_UUID.test(id)) {
    throw errorEntradaInvalida('El cursor `despues` no corresponde a esta conexion');
  }
  return id;
}

// Se recorta en silencio en vez de fallar: el cliente pide lo que quiera y el
// servicio nunca devuelve mas de 50 (RNF-903).
function limitarPagina(primero: unknown): number {
  const pedido = primero === undefined || primero === null ? 20 : Number(primero);
  if (!Number.isInteger(pedido) || pedido < 1) {
    throw errorEntradaInvalida('`primero` debe ser un entero mayor que cero');
  }
  return Math.min(pedido, MAXIMO_POR_PAGINA);
}

function exigirUuid(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !PATRON_UUID.test(valor)) {
    throw errorEntradaInvalida(`\`${campo}\` debe ser un UUID`);
  }
  return valor;
}

function exigirLecturaDeGrupo(token: TokenPayload, grupoId: string): void {
  if (!puedeLeerGrupo(token.rol, token.grupoId, grupoId)) {
    throw errorFueraDeAlcance('El rol no alcanza a leer este grupo');
  }
}

// FAM no lee grupos sino a su hijo; compartido/auth.ts lo deja escrito y delega
// aqui la resolucion por catequizando. En la demo el `sub` del token de la
// familia es el id del catequizando.
function exigirLecturaDeCatequizando(token: TokenPayload, fila: FilaCatequizando): void {
  if (token.rol === 'FAM') {
    if (fila.id !== token.sub) {
      throw errorFueraDeAlcance('El rol no alcanza a leer este catequizando');
    }
    return;
  }
  exigirLecturaDeGrupo(token, fila.grupoId);
}

async function resolverConexion(
  contexto: ContextoPeticion,
  grupoId: string,
  primero: unknown,
  despues: unknown
): Promise<ConexionCatequizandos> {
  const limite = limitarPagina(primero);
  const cursor = decodificarCursor(despues as string | null | undefined);

  // Se pide un nodo extra para saber si queda pagina siguiente sin contar dos veces.
  const filas = await contexto.datos.paginaDeCatequizandos(grupoId, limite + 1, cursor);
  const hayMas = filas.length > limite;
  const nodos = hayMas ? filas.slice(0, limite) : filas;

  return {
    nodos: nodos as unknown as ConexionCatequizandos['nodos'],
    siguiente: hayMas && nodos.length > 0 ? codificarCursor(nodos[nodos.length - 1].id) : null,
    total: await contexto.datos.totalDeCatequizandos(grupoId),
  };
}

export function crearResolvers(
  _dependencias: DependenciasResolvers = {}
): MapaResolvers<ContextoPeticion> {
  return {
    Query: {
      yo: (_origen, _argumentos, contexto): Contexto => {
        const token = exigirToken(contexto);
        return {
          identidadOperativa: token.identidadOperativa,
          rol: token.rol,
          grupoId: token.grupoId ?? null,
        };
      },

      catequizando: async (
        _origen,
        argumentos: { id: string },
        contexto
      ): Promise<FilaCatequizando | null> => {
        const token = exigirToken(contexto);
        const id = exigirUuid(argumentos.id, 'id');
        const fila = await contexto.cargadores.catequizando.cargar(id);
        // Un id inexistente devuelve null; uno existente fuera de alcance
        // devuelve el codigo del contrato. Los UUID no son adivinables, asi que
        // la diferencia no filtra nada util.
        if (!fila) return null;
        exigirLecturaDeCatequizando(token, fila);
        return fila;
      },

      catequizandos: (
        _origen,
        argumentos: { grupoId: string; primero?: number; despues?: string },
        contexto
      ): Promise<ConexionCatequizandos> => {
        const token = exigirToken(contexto);
        const grupoId = exigirUuid(argumentos.grupoId, 'grupoId');
        exigirLecturaDeGrupo(token, grupoId);
        return resolverConexion(contexto, grupoId, argumentos.primero, argumentos.despues);
      },

      asistenciaDelDomingo: (
        _origen,
        argumentos: { grupoId: string; fecha: FechaCivil },
        contexto
      ): Promise<ResumenAsistencia> => {
        const token = exigirToken(contexto);
        const grupoId = exigirUuid(argumentos.grupoId, 'grupoId');
        exigirLecturaDeGrupo(token, grupoId);
        // La fecha ya la valido el escalar FechaCivil del contrato.
        return contexto.datos.resumenDelDomingo(grupoId, argumentos.fecha);
      },

      riesgoDelGrupo: (
        _origen,
        argumentos: { grupoId: string; nivelMinimo?: NivelRiesgo },
        contexto
      ): Promise<Riesgo[]> => {
        const token = exigirToken(contexto);
        const grupoId = exigirUuid(argumentos.grupoId, 'grupoId');
        exigirLecturaDeGrupo(token, grupoId);
        return contexto.datos.riesgoDelGrupo(grupoId, argumentos.nivelMinimo ?? 'MEDIO');
      },
    },

    Catequizando: {
      grupo: async (origen: FilaCatequizando, _argumentos, contexto): Promise<Grupo> => {
        const grupo = await contexto.cargadores.grupo.cargar(origen.grupoId);
        if (!grupo) {
          // La clave ajena del esquema lo impide; si pasa, es incoherencia de datos.
          throw errorEntradaInvalida('El catequizando apunta a un grupo que no existe');
        }
        return grupo;
      },

      asistencias: (
        origen: FilaCatequizando,
        argumentos: { desde?: FechaCivil; hasta?: FechaCivil },
        contexto
      ): Promise<Asistencia[]> =>
        contexto.cargadores
          .asistencias(argumentos.desde ?? null, argumentos.hasta ?? null)
          .cargar(origen.id)
          .then((asistencias) => asistencias ?? []),

      riesgo: (
        origen: FilaCatequizando,
        _argumentos,
        contexto
      ): Promise<Riesgo | undefined> => contexto.cargadores.riesgo.cargar(origen.id),
    },

    Grupo: {
      catequizandos: (
        origen: Grupo,
        argumentos: { primero?: number; despues?: string },
        contexto
      ): Promise<ConexionCatequizandos> => {
        const token = exigirToken(contexto);
        exigirLecturaDeGrupo(token, origen.id);
        return resolverConexion(contexto, origen.id, argumentos.primero, argumentos.despues);
      },
    },
  };
}
