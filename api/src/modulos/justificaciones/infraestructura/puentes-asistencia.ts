import type { AlCambiarAsistencia, FuenteJustificacionesAprobadas } from "../../asistencia/dominio/puertos";
import { consultarAusencias } from "../../asistencia/aplicacion/consultar-faltas";
import { repositorioJustificacionesPg } from "./repositorio-justificaciones-pg";

/** Una aprobada con efecto deja de contar la falta en 003 y en el riesgo de 007 (RF-407, RF-408). */
export const fuenteJustificacionesAprobadasPg: FuenteJustificacionesAprobadas = {
  async consultar(cicloId, tx) {
    const filas = await tx.query<{ catequizandoId: string; fecha: string }>(
      `SELECT DISTINCT catequizando_id AS "catequizandoId",fecha_sesion::text AS fecha FROM justificacion
       WHERE ciclo_id=$1 AND estado_revision='aprobada' AND sin_efecto_desde IS NULL`,
      [cicloId],
    );
    return filas.rows;
  },
};

/** Si la ausencia se corrige a presente la justificación queda sin efecto; si vuelve a ausente, se restaura (RF-407). */
export const alCambiarAsistenciaJustificaciones: AlCambiarAsistencia = async ({ cicloId, catequizandoId, fecha }, tx) => {
  const afectadas = await tx.query<{ sesion_id: string }>(
    "SELECT DISTINCT sesion_id FROM justificacion WHERE ciclo_id=$1 AND catequizando_id=$2 AND fecha_sesion=$3",
    [cicloId, catequizandoId, fecha],
  );
  if (!afectadas.rowCount) return;
  const ausentes = new Set((await consultarAusencias(cicloId, { catequizandoId, desde: fecha, hasta: fecha }, tx)).map((e) => e.sesion.id));
  for (const { sesion_id: sesionId } of afectadas.rows) {
    if (ausentes.has(sesionId)) await repositorioJustificacionesPg.restaurarEfecto(tx, { catequizandoId, sesionId });
    else await repositorioJustificacionesPg.marcarSinEfecto(tx, { catequizandoId, sesionId }, new Date());
  }
};
