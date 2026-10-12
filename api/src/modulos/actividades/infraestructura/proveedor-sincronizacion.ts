import type { EntradaActividad } from "../dominio/validacion";
import type { ProveedorSincronizacion } from "../../sincronizacion/aplicacion/registro-proveedores";
export const proveedorActividades: ProveedorSincronizacion = {
  tablas: ["actividades_obligatorias"],
  async pull({ cicloId, desde, hasta }, tx) {
    const filas = await tx.query<EntradaActividad & { eliminado_en: Date | null }>(`SELECT id,ciclo_id,nombre,tipo,fecha::text,estado,creado_por,cuenta_id,credencial_id,dispositivo_id,eliminado_en FROM actividad_obligatoria
      WHERE ciclo_id=$1 AND actualizado_en<=to_timestamp($2/1000.0) AND ($3::double precision IS NULL OR actualizado_en>to_timestamp($3/1000.0))`, [cicloId, hasta, desde]);
    return { actividades_obligatorias: { created: filas.rows.filter(fila => !fila.eliminado_en).map(({ eliminado_en: _eliminado, ...fila }) => fila), updated: [], deleted: filas.rows.filter(fila => fila.eliminado_en).map(fila => fila.id) } };
  },
};
