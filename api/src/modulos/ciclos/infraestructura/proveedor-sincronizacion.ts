import type { ProveedorSincronizacion } from "../../sincronizacion/aplicacion/registro-proveedores";
export const proveedorCiclos: ProveedorSincronizacion = {
  tablas: ["ciclos"],
  async pull({ cicloId }, tx) {
    const ciclos = await tx.query<{ id: string; nombre: string; fecha_inicio: string; fecha_fin: string; estado: string }>("SELECT id,nombre,inicio::text AS fecha_inicio,fin::text AS fecha_fin,estado FROM ciclo WHERE id=$1 AND estado='abierto'", [cicloId]);
    return { ciclos: { created: ciclos.rows, updated: [], deleted: [] } };
  },
};
