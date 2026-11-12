import type { Tx } from "../../../compartido/bd/transaccion";
import type { AlCambiarAsistencia } from "../../asistencia/dominio/puertos";
import { notificarCambioJustificacion, type RepositorioJustificaciones } from "../dominio/puertos";
import { repositorioJustificacionesPg } from "../infraestructura/repositorio-justificaciones-pg";

/**
 * 003 avisa por niño y fecha, no por sesión: se revisan todas las sesiones de ese día que tienen
 * una justificación. Corre en la transacción de la corrección para que ambos cambios sean atómicos.
 */
export function crearAlCambiarAsistencia(repo: RepositorioJustificaciones = repositorioJustificacionesPg, reloj: () => Date = () => new Date()): AlCambiarAsistencia {
  return async ({ cicloId, catequizandoId, fecha }, tx: Tx) => {
    const filas = await tx.query<{ sesion_id: string; valor: string | null }>(`SELECT DISTINCT j.sesion_id,a.valor FROM justificacion j
      LEFT JOIN asistencia a ON a.sesion_id=j.sesion_id AND a.catequizando_id=j.catequizando_id AND a.eliminado_en IS NULL
      WHERE j.ciclo_id=$1 AND j.catequizando_id=$2 AND j.fecha_sesion=$3 ORDER BY j.sesion_id`, [cicloId, catequizandoId, fecha]);
    const cambiadas: string[] = [];
    for (const fila of filas.rows) {
      const ausencia = { catequizandoId, sesionId: fila.sesion_id };
      if (fila.valor === "presente") cambiadas.push(...await repo.marcarSinEfecto(tx, ausencia, reloj()));
      else if (fila.valor === "ausente") cambiadas.push(...await repo.restaurarEfecto(tx, ausencia));
    }
    const justificaciones = [];
    for (const id of cambiadas) { const j = await repo.obtener(tx, id); if (j) justificaciones.push(j); }
    await notificarCambioJustificacion(justificaciones, tx);
  };
}

export const alCambiarAsistencia = crearAlCambiarAsistencia();
