import { codificarCarne } from "@/lib/catequizandos/carne";
import { consultar } from "../../../compartido/bd/pool";
export type AlcanceNomina = { cuentaId: string; gruposAsignados?: string[]; reemplazar?: boolean };
export type FilaNomina = { id: string; nombres: string; apellidos: string; grupo_id: string; codigo_carne: string; activo: boolean };
export type FilaGrupo = { id: string; nombre: string; ciclo_id: string; estado: string; es_mio: boolean };
export const proveedorNomina = {
  async cambiosDesde(cursor: number | null, alcance: AlcanceNomina) {
    const desde = cursor === null || alcance.reemplazar ? null : new Date(cursor - 60000).toISOString();
    const filas = await consultar<{ id: string; nombres: string; apellidos: string; grupo_id: string; emision: number }>("SELECT catequizando_id AS id,nombres,apellidos,grupo_id,emision FROM v_nomina_ciclo WHERE ($1::timestamptz IS NULL OR actualizado_en>$1) AND emision IS NOT NULL ORDER BY catequizando_id", [desde]);
    const nomina: FilaNomina[] = filas.rows.map(n => ({ id: n.id, nombres: n.nombres, apellidos: n.apellidos, grupo_id: n.grupo_id, codigo_carne: codificarCarne(n.id, n.emision), activo: true }));
    const eliminados = await consultar<{ id: string }>("SELECT n.id FROM catequizando n WHERE ($1::timestamptz IS NULL OR n.actualizado_en>$1 OR EXISTS(SELECT 1 FROM inscripcion i JOIN ciclo c ON c.id=i.ciclo_id WHERE i.catequizando_id=n.id AND c.cerrado_en>$1)) AND NOT EXISTS(SELECT 1 FROM v_nomina_ciclo v WHERE v.catequizando_id=n.id) ORDER BY n.id", [desde]);
    const grupos = await consultar<FilaGrupo>("SELECT g.id,g.nombre,g.ciclo_id,g.estado,EXISTS(SELECT 1 FROM grupo_catequista gc WHERE gc.grupo_id=g.id AND gc.cuenta_id=$2 AND gc.hasta IS NULL) AS es_mio FROM grupo g JOIN ciclo c ON c.id=g.ciclo_id AND c.estado='abierto' WHERE ($1::timestamptz IS NULL OR g.actualizado_en>$1) ORDER BY g.id", [desde, alcance.cuentaId]);
    const gruposEliminados = await consultar<{ id: string }>("SELECT g.id FROM grupo g JOIN ciclo c ON c.id=g.ciclo_id WHERE c.estado='cerrado' AND ($1::timestamptz IS NULL OR c.cerrado_en>$1) ORDER BY g.id", [desde]);
    const completo = desde === null;
    return {
      catequizandos: { creados: completo ? nomina : [], actualizados: completo ? [] : nomina, eliminados: eliminados.rows.map(n => n.id) },
      grupos: { creados: completo ? grupos.rows : [], actualizados: completo ? [] : grupos.rows, eliminados: gruposEliminados.rows.map(g => g.id) }
    };
  }
};
