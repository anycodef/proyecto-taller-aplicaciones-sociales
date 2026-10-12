import { enTransaccion } from "../../../compartido/bd/transaccion";
import { consultarEstados } from "./consultar-faltas";
import { leerMarcas } from "../infraestructura/repositorio-pg";
export async function consultarCumplimientoActividad(actividadId: string) {
  return enTransaccion(async tx => {
    const actividad = await tx.query<{ ciclo_id: string }>("SELECT ciclo_id FROM actividad_obligatoria WHERE id=$1", [actividadId]);
    if (!actividad.rowCount) return [];
    const estados = (await consultarEstados(actividad.rows[0].ciclo_id, { tipo: "actividad" }, tx)).filter(fila => fila.sesion.actividadId === actividadId);
    const resultado = [];
    for (const fila of estados) {
      const marcas = await leerMarcas(fila.sesion.id, fila.catequizandoId, tx);
      const ids = [...new Set(marcas.map(marca => marca.registradoPor))];
      const autores = await tx.query<{ identidad_operativa: string }>("SELECT identidad_operativa FROM cuenta WHERE id=ANY($1::uuid[])", [ids]);
      resultado.push({ catequizandoId: fila.catequizandoId, sesionId: fila.sesion.id, estado: fila.estado, registradores: autores.rows.map(autor => autor.identidad_operativa) });
    }
    return resultado;
  });
}
