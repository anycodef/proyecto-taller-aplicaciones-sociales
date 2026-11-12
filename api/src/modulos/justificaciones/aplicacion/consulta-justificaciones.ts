import { ausenciaMisaJustificada, estadoParaRiesgo, faltaJustificada, fechasJustificadas, type EstadoParaRiesgo } from "@/lib/justificaciones/efectos";
import { fechaLimite } from "@/lib/justificaciones/plazo";
import type { Tx } from "../../../compartido/bd/transaccion";
import type { FuenteJustificacionesAprobadas } from "../../asistencia/dominio/puertos";
import type { RepositorioJustificaciones } from "../dominio/puertos";
import { repositorioJustificacionesPg } from "../infraestructura/repositorio-justificaciones-pg";

type Ausencia = { catequizandoId: string; fecha: string };

/** Lecturas en proceso para 003, 006 y 007: aplican las reglas puras de `efectos.ts` sobre el ciclo (D-414). */
export interface ConsultaJustificaciones {
  faltaJustificada(cicloId: string, ausencia: Ausencia, tx: Tx): Promise<boolean>;
  ausenciaMisaJustificada(cicloId: string, ausencia: { catequizandoId: string; sesionId: string }, tx: Tx): Promise<boolean>;
  estadoParaRiesgo(cicloId: string, ausencia: Ausencia, tx: Tx): Promise<EstadoParaRiesgo>;
  diasPlazo(cicloId: string, tx: Tx): Promise<number>;
  /** Fin del plazo de la ausencia, para que 007 sepa si aún puede justificarse. */
  venceEn(cicloId: string, fecha: string, tx: Tx): Promise<string>;
  aprobadas(cicloId: string, tx: Tx): Promise<Ausencia[]>;
}

export function crearConsultaJustificaciones(repo: RepositorioJustificaciones = repositorioJustificacionesPg): ConsultaJustificaciones {
  const delCiclo = (cicloId: string, tx: Tx) => repo.listarPorCiclo(tx, cicloId);
  const diasPlazo = async (cicloId: string, tx: Tx) => (await repo.obtenerPlazo(tx, cicloId)).diasPlazo;
  return {
    faltaJustificada: async (cicloId, a, tx) => faltaJustificada(a.fecha, a.catequizandoId, await delCiclo(cicloId, tx)),
    ausenciaMisaJustificada: async (cicloId, a, tx) => ausenciaMisaJustificada(a.sesionId, a.catequizandoId, await delCiclo(cicloId, tx)),
    estadoParaRiesgo: async (cicloId, a, tx) => estadoParaRiesgo(a, await delCiclo(cicloId, tx)),
    diasPlazo,
    venceEn: async (cicloId, fecha, tx) => fechaLimite(fecha, await diasPlazo(cicloId, tx)),
    aprobadas: async (cicloId, tx) => fechasJustificadas(await delCiclo(cicloId, tx)),
  };
}

export const consultaJustificaciones = crearConsultaJustificaciones();

/** Sustituye a `fuenteJustificacionesVacia` de 003: `faltasDelCiclo` recibe las fechas aprobadas vigentes (RF-409). */
export const fuenteJustificacionesAprobadas: FuenteJustificacionesAprobadas = { consultar: (cicloId, tx) => consultaJustificaciones.aprobadas(cicloId, tx) };
