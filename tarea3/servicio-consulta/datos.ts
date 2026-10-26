// Acceso de lectura al esquema demo_tarea3 (spec 009, RF-902).
//
// Todas las consultas son por lote (`= ANY($1)`) para que el cargador pueda
// resolver a todos los hermanos de un nivel con una sola ida a PostgreSQL.
// Ninguna selecciona salud, neurodivergencia ni documentos: el modelo de
// plan §4 no los tiene y las columnas se listan explicitamente, nunca con `*`
// (RF-907).

import type {
  Asistencia,
  EstadoAsistencia,
  FechaCivil,
  Grupo,
  NivelRiesgo,
  Riesgo,
} from '../compartido/tipos.ts';

// Minimo que se necesita de pg.Pool; permite inyectar un doble en las pruebas.
export interface EjecutorSql {
  query: (texto: string, valores?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

export interface FilaCatequizando {
  id: string;
  grupoId: string;
  identidadOperativa: string;
  edad: number;
}

export interface Datos {
  catequizandosPorIds: (ids: readonly string[]) => Promise<Map<string, FilaCatequizando>>;
  gruposPorIds: (ids: readonly string[]) => Promise<Map<string, Grupo>>;
  asistenciasPorCatequizandos: (
    ids: readonly string[],
    desde?: FechaCivil | null,
    hasta?: FechaCivil | null
  ) => Promise<Map<string, Asistencia[]>>;
  riesgosPorCatequizandos: (ids: readonly string[]) => Promise<Map<string, Riesgo>>;
  paginaDeCatequizandos: (
    grupoId: string,
    limite: number,
    desde: string | null
  ) => Promise<FilaCatequizando[]>;
  totalDeCatequizandos: (grupoId: string) => Promise<number>;
}

function aCatequizando(fila: Record<string, unknown>): FilaCatequizando {
  return {
    id: String(fila.id),
    grupoId: String(fila.grupo_id),
    identidadOperativa: String(fila.identidad_operativa),
    edad: Number(fila.edad),
  };
}

export function crearDatos(ejecutor: EjecutorSql): Datos {
  return {
    async catequizandosPorIds(ids) {
      const mapa = new Map<string, FilaCatequizando>();
      if (ids.length === 0) return mapa;
      const { rows } = await ejecutor.query(
        `SELECT id, grupo_id, identidad_operativa, edad
           FROM demo_tarea3.catequizando
          WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      for (const fila of rows) mapa.set(String(fila.id), aCatequizando(fila));
      return mapa;
    },

    async gruposPorIds(ids) {
      const mapa = new Map<string, Grupo>();
      if (ids.length === 0) return mapa;
      const { rows } = await ejecutor.query(
        `SELECT id, nombre FROM demo_tarea3.grupo WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      for (const fila of rows) {
        mapa.set(String(fila.id), { id: String(fila.id), nombre: String(fila.nombre) });
      }
      return mapa;
    },

    async asistenciasPorCatequizandos(ids, desde, hasta) {
      const mapa = new Map<string, Asistencia[]>();
      if (ids.length === 0) return mapa;
      // fecha::text evita que pg devuelva un Date y que la conversion a UTC
      // desplace el dia civil.
      const { rows } = await ejecutor.query(
        `SELECT id, catequizando_id, fecha::text AS fecha, estado, registrado_por
           FROM demo_tarea3.asistencia
          WHERE catequizando_id = ANY($1::uuid[])
            AND ($2::date IS NULL OR fecha >= $2::date)
            AND ($3::date IS NULL OR fecha <= $3::date)
          ORDER BY fecha, id`,
        [ids, desde ?? null, hasta ?? null]
      );
      for (const id of ids) mapa.set(id, []);
      for (const fila of rows) {
        const lista = mapa.get(String(fila.catequizando_id));
        if (!lista) continue;
        lista.push({
          id: String(fila.id),
          fecha: String(fila.fecha),
          estado: String(fila.estado) as EstadoAsistencia,
          // registrado_por guarda siempre identidadOperativa (RF-907).
          registradoPor: String(fila.registrado_por),
        });
      }
      return mapa;
    },

    async riesgosPorCatequizandos(ids) {
      const mapa = new Map<string, Riesgo>();
      if (ids.length === 0) return mapa;
      const { rows } = await ejecutor.query(
        `SELECT catequizando_id, nivel, motivo, calculado_en
           FROM demo_tarea3.riesgo
          WHERE catequizando_id = ANY($1::uuid[])`,
        [ids]
      );
      for (const fila of rows) {
        mapa.set(String(fila.catequizando_id), {
          catequizandoId: String(fila.catequizando_id),
          nivel: String(fila.nivel) as NivelRiesgo,
          motivo: String(fila.motivo),
          calculadoEn: new Date(String(fila.calculado_en)).toISOString(),
        });
      }
      return mapa;
    },

    async paginaDeCatequizandos(grupoId, limite, desde) {
      // Cursor por id (keyset): estable aunque se inserten filas entre paginas.
      const { rows } = await ejecutor.query(
        `SELECT id, grupo_id, identidad_operativa, edad
           FROM demo_tarea3.catequizando
          WHERE grupo_id = $1::uuid
            AND ($2::uuid IS NULL OR id > $2::uuid)
          ORDER BY id
          LIMIT $3`,
        [grupoId, desde, limite]
      );
      return rows.map(aCatequizando);
    },

    async totalDeCatequizandos(grupoId) {
      const { rows } = await ejecutor.query(
        `SELECT count(*)::int AS total FROM demo_tarea3.catequizando WHERE grupo_id = $1::uuid`,
        [grupoId]
      );
      return Number(rows[0]?.total ?? 0);
    },
  };
}
