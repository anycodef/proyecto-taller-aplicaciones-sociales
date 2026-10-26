// Cargadores por peticion (spec 009, T009-23).
//
// Se crean uno por peticion y no se comparten entre peticiones: un cargador
// cachea lo que ya resolvio, y compartirlo entre usuarios distintos serviria
// datos de un grupo a quien no puede verlos.

import { crearCargador, type Cargador } from './cargador.ts';
import type { Datos, FilaCatequizando } from './datos.ts';
import type { Asistencia, FechaCivil, Grupo, Riesgo } from '../compartido/tipos.ts';

export interface Cargadores {
  catequizando: Cargador<string, FilaCatequizando>;
  grupo: Cargador<string, Grupo>;
  riesgo: Cargador<string, Riesgo>;
  // `asistencias` depende de los argumentos del campo, asi que hay un cargador
  // por rango de fechas pedido; dentro del rango el lote sigue siendo uno.
  asistencias: (desde?: FechaCivil | null, hasta?: FechaCivil | null) => Cargador<string, Asistencia[]>;
}

export function crearCargadores(datos: Datos): Cargadores {
  const porRango = new Map<string, Cargador<string, Asistencia[]>>();

  return {
    catequizando: crearCargador((ids) => datos.catequizandosPorIds(ids)),
    grupo: crearCargador((ids) => datos.gruposPorIds(ids)),
    riesgo: crearCargador((ids) => datos.riesgosPorCatequizandos(ids)),
    asistencias(desde, hasta) {
      const clave = `${desde ?? ''}|${hasta ?? ''}`;
      let cargador = porRango.get(clave);
      if (!cargador) {
        cargador = crearCargador((ids) => datos.asistenciasPorCatequizandos(ids, desde, hasta));
        porRango.set(clave, cargador);
      }
      return cargador;
    },
  };
}
