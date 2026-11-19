import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import type { FilaSincronizada } from "@/lib/sincronizacion/protocolo";
import type { Tx } from "../../../compartido/bd/transaccion";
import type { PeticionProveedor, ProveedorSincronizacion } from "../../sincronizacion/aplicacion/registro-proveedores";

type FilaEstado = { id: string; catequizando_id: string; sesion_id: string; fecha: string; tipo_sesion: string; estado: string };

/**
 * Solo el estado visible por ausencia (D-408): ni causa, ni motivo, ni quién envió, ni evidencia.
 * El catequista recibe los niños de sus grupos vigentes; coordinación, todo el ciclo (RF-410).
 */
export const proveedorJustificaciones: ProveedorSincronizacion = {
  tablas: ["justificaciones_estado"],
  async pull({ cuenta, cicloId, desde, hasta }: PeticionProveedor, tx: Tx) {
    const coordinacion = rolesEfectivos(cuenta).includes("coordinacion");
    const filas = await tx.query<FilaEstado>(`SELECT j.id,j.catequizando_id,j.sesion_id,j.fecha_sesion::text AS fecha,j.tipo_sesion,
        CASE WHEN j.sin_efecto_desde IS NOT NULL THEN 'sin_efecto' ELSE j.estado_revision END AS estado
      FROM justificacion j
      WHERE j.ciclo_id=$1 AND j.actualizado_en<=to_timestamp($2/1000.0) AND ($3::double precision IS NULL OR j.actualizado_en>to_timestamp($3/1000.0))
        AND ($4 OR EXISTS(SELECT 1 FROM inscripcion i JOIN asignacion_grupo a ON a.inscripcion_id=i.id
          WHERE i.catequizando_id=j.catequizando_id AND i.ciclo_id=j.ciclo_id AND i.estado='vigente'
            AND i.desde<=now() AND (i.hasta IS NULL OR i.hasta>now())
            AND a.desde<=now() AND (a.hasta IS NULL OR a.hasta>now()) AND a.grupo_id=ANY($5::uuid[])))
      ORDER BY j.actualizado_en,j.id`, [cicloId, hasta, desde, coordinacion, cuenta.gruposAsignados]);
    const created: FilaSincronizada[] = filas.rows.map(f => ({ ...f }));
    return { justificaciones_estado: { created, updated: [], deleted: [] } };
  },
};
