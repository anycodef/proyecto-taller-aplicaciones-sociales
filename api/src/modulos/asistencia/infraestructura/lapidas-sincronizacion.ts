import type { Tx } from "../../../compartido/bd/transaccion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import type { CambiosPorTabla } from "@/lib/sincronizacion/protocolo";

const proyecciones = [
  { tabla: "asistencia", coleccion: "asistencias", autor: "NULL::uuid" },
  { tabla: "marca_asistencia", coleccion: "marcas_asistencia", autor: "t.cuenta_id" },
  { tabla: "correccion_asistencia", coleccion: "correcciones_asistencia", autor: "t.cuenta_id" },
  { tabla: "lista_asistencia", coleccion: "listas_asistencia", autor: "t.cuenta_id" },
] as const;

export async function encolarLapidasRetencion(tx: Tx, objetivo: { catequizandoId: string; cicloId?: string } | { cicloId: string }): Promise<void> {
  const ninoId = "catequizandoId" in objetivo ? objetivo.catequizandoId : null;
  for (const proyeccion of proyecciones) {
    if (ninoId && proyeccion.tabla === "lista_asistencia") continue;
    const filtro = ninoId
      ? `(t.catequizando_id=$1${proyeccion.tabla === "marca_asistencia" ? " OR position(lower($1::text) in lower(COALESCE(t.codigo_leido,'')))>0" : ""}) AND ($2::uuid IS NULL OR t.ciclo_id=$2)`
      : "$1::uuid IS NULL AND t.ciclo_id=$2";
    const grupos = proyeccion.tabla === "lista_asistencia"
      ? "gc.grupo_id=t.grupo_id"
      : `EXISTS(SELECT 1 FROM inscripcion i JOIN asignacion_grupo a ON a.inscripcion_id=i.id
          WHERE i.catequizando_id=COALESCE($1::uuid,t.catequizando_id) AND i.ciclo_id=t.ciclo_id AND a.grupo_id=gc.grupo_id)`;
    // La audiencia se captura antes de borrar autoría o cambiar el id. NULL representa coordinación.
    await tx.query(`INSERT INTO lapida_sincronizacion(tabla,fila_id,cuenta_id,ciclo_id)
      SELECT $3,t.id,d.cuenta_id,t.ciclo_id FROM ${proyeccion.tabla} t
      CROSS JOIN LATERAL (
        SELECT NULL::uuid AS cuenta_id
        UNION SELECT ${proyeccion.autor} WHERE ${proyeccion.autor} IS NOT NULL
        UNION SELECT gc.cuenta_id FROM grupo_catequista gc JOIN cuenta c ON c.id=gc.cuenta_id AND c.activa
          WHERE gc.desde<=clock_timestamp() AND (gc.hasta IS NULL OR gc.hasta>clock_timestamp()) AND ${grupos}
      ) d WHERE ${filtro} AND t.eliminado_en IS NULL
      ON CONFLICT(tabla,fila_id,cuenta_id) DO NOTHING`, [ninoId, objetivo.cicloId ?? null, proyeccion.coleccion]);
  }
}

export async function incorporarLapidas(changes: CambiosPorTabla, cuenta: ContextoAcceso, desde: number | null, hasta: number, tx: Tx): Promise<void> {
  const resultado = await tx.query<{ tabla: string; fila_id: string }>(`SELECT tabla,fila_id FROM lapida_sincronizacion
    WHERE (cuenta_id=$1 OR (cuenta_id IS NULL AND $2::boolean))
      AND eliminado_en<=to_timestamp($3/1000.0)
      AND eliminado_en>=to_timestamp($3/1000.0)-interval '60 days'
      AND ($4::double precision IS NULL OR eliminado_en>to_timestamp($4/1000.0))`,
  [cuenta.cuentaId, rolesEfectivos(cuenta).includes("coordinacion"), hasta, desde]);
  for (const { tabla, fila_id: id } of resultado.rows) {
    const cambios = changes[tabla];
    if (!cambios) throw new Error("Colección de lápidas no registrada");
    cambios.created = cambios.created.filter(fila => fila.id !== id);
    cambios.updated = cambios.updated.filter(fila => fila.id !== id);
    cambios.deleted = [...new Set([...cambios.deleted, id])];
  }
}

// El planificador transversal ejecuta este puerto con rol y contexto de retención.
export async function depurarLapidasSincronizacion(tx: Tx): Promise<number> {
  const resultado = await tx.query("DELETE FROM lapida_sincronizacion WHERE eliminado_en<clock_timestamp()-interval '60 days'");
  return resultado.rowCount ?? 0;
}
