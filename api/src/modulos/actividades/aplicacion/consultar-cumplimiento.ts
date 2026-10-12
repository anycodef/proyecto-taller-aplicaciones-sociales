import { rolesEfectivos, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { estadoCumplimiento } from "@/lib/actividades/cumplimiento";
import type { Actividad } from "@/lib/actividades/catalogo-actividades";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { consultarEstados } from "../../asistencia/aplicacion/consultar-faltas";
import { leerMarcas } from "../../asistencia/infraestructura/repositorio-pg";
import { obtenerFuenteJustificaciones } from "../../asistencia/dominio/puertos";
export async function consultarCumplimiento(id: string, ctx: ContextoAcceso, tx: Tx) {
  const coordinacion = rolesEfectivos(ctx).includes("coordinacion");
  if (!coordinacion && !ctx.rolesPropios.includes("catequista")) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const actividad = (await tx.query<Actividad>(`SELECT a.id,a.ciclo_id AS "cicloId",a.nombre,a.tipo,a.fecha::text,a.estado FROM actividad_obligatoria a JOIN ciclo c ON c.id=a.ciclo_id AND c.estado='abierto' WHERE a.id=$1 AND a.eliminado_en IS NULL FOR SHARE OF a,c`, [id])).rows[0];
  if (!actividad) throw new ErrorAplicacion(404, "actividad_no_disponible");
  const ninos = await tx.query<{ catequizando_id: string }>(`SELECT i.catequizando_id FROM inscripcion i JOIN asignacion_grupo g ON g.inscripcion_id=i.id WHERE i.ciclo_id=$1 AND i.estado='vigente' AND g.hasta IS NULL AND ($2 OR g.grupo_id=ANY($3::uuid[]))`, [actividad.cicloId, coordinacion, ctx.gruposAsignados]);
  const permitidos = new Set(ninos.rows.map(fila => fila.catequizando_id));
  const estados = (await consultarEstados(actividad.cicloId, { tipo: "actividad", desde: actividad.fecha, hasta: actividad.fecha }, tx)).filter(fila => fila.sesion.actividadId === id && permitidos.has(fila.catequizandoId));
  const justificadas = await obtenerFuenteJustificaciones().consultar(actividad.cicloId, tx);
  const resultado = [];
  for (const fila of estados) {
    const marcas = await leerMarcas(fila.sesion.id, fila.catequizandoId, tx);
    const autores = await tx.query<{ identidad_operativa: string }>("SELECT identidad_operativa FROM cuenta WHERE id=ANY($1::uuid[])", [[...new Set(marcas.map(marca => marca.registradoPor))]]);
    resultado.push({ catequizandoId: fila.catequizandoId, sesionId: fila.sesion.id,
      estado: estadoCumplimiento(actividad, { activoEnFecha: fila.estado !== "no_aplica", presente: fila.estado === "presente", justificada: justificadas.some(justificacion => justificacion.fecha === fila.sesion.fecha && justificacion.catequizandoId === fila.catequizandoId), finalizada: fila.estado === "ausente" }),
      registradores: autores.rows.map(autor => autor.identidad_operativa) });
  }
  return resultado;
}
