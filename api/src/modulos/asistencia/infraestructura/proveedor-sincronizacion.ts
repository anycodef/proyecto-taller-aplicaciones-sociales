import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import { tablasAsistencia } from "@/lib/asistencia/tablas-sincronizadas";
import type { CambiosTabla, FilaSincronizada } from "@/lib/sincronizacion/protocolo";
import type { Tx } from "../../../compartido/bd/transaccion";
import type { PeticionProveedor, ProveedorSincronizacion } from "../../sincronizacion/aplicacion/registro-proveedores";

export async function consultarNomina(cicloId: string, tx: Tx): Promise<FilaSincronizada[]> {
  const resultado = await tx.query<{ id: string; nombres: string; apellidos: string; grupo_id: string; codigo_carne: string | null; activo: boolean }>(`SELECT v.catequizando_id AS id,v.nombres,v.apellidos,v.grupo_id,
    CASE WHEN v.emision IS NULL THEN NULL ELSE 'SGC1:' || v.catequizando_id::text || ':' || v.emision::text END AS codigo_carne,true AS activo
    FROM v_nomina_ciclo v WHERE v.ciclo_id=$1`, [cicloId]);
  return resultado.rows;
}
function serializar(fila: Record<string, unknown>): FilaSincronizada {
  const salida: Record<string, string | number | boolean | null> = {};
  for (const [nombre, valor] of Object.entries(fila)) {
    if (nombre === "eliminado_en" || nombre === "actualizado_en") continue;
    if (valor instanceof Date) salida[nombre] = valor.getTime();
    else if (valor === null || typeof valor === "number" || typeof valor === "boolean") salida[nombre] = valor;
    else if (typeof valor === "string") salida[nombre] = nombre === "desfase_reloj_ms" ? Number(valor) : valor;
    else throw new Error("Proyección sincronizada inválida");
  }
  return salida as FilaSincronizada;
}
export const proveedorAsistencia: ProveedorSincronizacion = {
  tablas: tablasAsistencia.map(tabla => tabla.nombre),
  async pull(peticion: PeticionProveedor, tx: Tx) {
    const { cuenta, cicloId, desde, hasta } = peticion;
    const cambios: Record<string, CambiosTabla> = {};
    const nomina = await consultarNomina(cicloId, tx);
    const sellos = await tx.query<{ id: string; actualizado_en: Date }>("SELECT id,actualizado_en FROM catequizando WHERE actualizado_en<=to_timestamp($1/1000.0)", [hasta]);
    const actualizados = new Set(sellos.rows.filter(fila => desde === null || fila.actualizado_en.getTime() > desde).map(fila => fila.id));
    cambios.catequizandos = { created: nomina.filter(fila => actualizados.has(fila.id)), updated: [], deleted: sellos.rows.filter(fila => actualizados.has(fila.id) && !nomina.some(nino => nino.id === fila.id)).map(fila => fila.id) };
    const grupos = await tx.query<{ id: string; nombre: string; ciclo_id: string; estado: string; eliminado_en: Date | null; actualizado_en: Date }>("SELECT id,nombre,ciclo_id,estado,eliminado_en,actualizado_en FROM grupo WHERE ciclo_id=$1 AND actualizado_en<=to_timestamp($2/1000.0) AND ($3::double precision IS NULL OR actualizado_en>to_timestamp($3/1000.0))", [cicloId, hasta, desde]);
    cambios.grupos = { created: grupos.rows.filter(fila => !fila.eliminado_en && fila.estado === "abierto").map(fila => ({ id: fila.id, nombre: fila.nombre, ciclo_id: fila.ciclo_id, estado: fila.estado, es_mio: cuenta.gruposAsignados.includes(fila.id) })), updated: [], deleted: grupos.rows.filter(fila => fila.eliminado_en || fila.estado !== "abierto").map(fila => fila.id) };
    const coordinacion = rolesEfectivos(cuenta).includes("coordinacion");
    for (const tabla of tablasAsistencia.filter(tabla => !["catequizandos", "grupos"].includes(tabla.nombre))) {
      const columnas = Object.keys(tabla.columnas);
      const seleccion = [tabla.nombre === "parametros_asistencia" ? "t.ciclo_id AS id" : "t.id", ...columnas.map(columna => {
        if (columna === "fecha") return "t.fecha::text AS fecha";
        if (["ventana_inicio", "ventana_fin", "ventana_misa_inicio", "ventana_misa_fin", "hora_fin_domingo"].includes(columna)) return `t.${columna}::text AS ${columna}`;
        return `t.${columna}`;
      }), "t.eliminado_en"].join(",");
      let alcance = "";
      const valores: unknown[] = [cicloId, hasta, desde];
      if (!coordinacion && tabla.alcance === "propias") { valores.push(cuenta.cuentaId); alcance = " AND t.cuenta_id=$4"; }
      if (!coordinacion && tabla.alcance === "mis_grupos") {
        valores.push(cuenta.gruposAsignados, cuenta.cuentaId);
        alcance = ` AND (EXISTS(SELECT 1 FROM inscripcion i JOIN asignacion_grupo a ON a.inscripcion_id=i.id
          WHERE i.catequizando_id=t.catequizando_id AND i.ciclo_id=t.ciclo_id AND i.estado='vigente' AND a.hasta IS NULL AND a.grupo_id=ANY($4::uuid[]))${tabla.nombre === "correcciones_asistencia" ? " OR t.cuenta_id=$5" : ""})`;
        if (tabla.nombre !== "correcciones_asistencia") valores.pop();
      }
      const resultado = await tx.query<Record<string, unknown>>(`SELECT ${seleccion} FROM ${tabla.tablaSql} t
        WHERE t.ciclo_id=$1 AND t.actualizado_en<=to_timestamp($2/1000.0) AND ($3::double precision IS NULL OR t.actualizado_en>to_timestamp($3/1000.0))${alcance}`, valores);
      cambios[tabla.nombre] = { created: resultado.rows.filter(fila => !fila.eliminado_en).map(serializar), updated: [], deleted: resultado.rows.filter(fila => fila.eliminado_en).map(fila => String(fila.id)) };
    }
    return cambios;
  },
};
