import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
import { ausenciasDelCiclo, estadoEnSesion, faltasDelCiclo, type EstadoPorSesion } from "@/lib/asistencia/faltas";
import type { Falta, Sesion, ValorAsistencia } from "@/lib/asistencia/tipos";
import { obtenerFuenteInscripciones } from "../infraestructura/fuente-inscripciones-pg";
import { obtenerActividadSumaFalta, obtenerFuenteJustificaciones } from "../dominio/puertos";
import { leerParametros } from "../infraestructura/repositorio-pg";
export interface FiltroAsistencia { catequizandoId?: string; desde?: string; hasta?: string; tipo?: Sesion["tipo"]; ahora?: number }
export async function consultarEstados(cicloId: string, filtro: FiltroAsistencia, tx: Tx): Promise<EstadoPorSesion[]> {
  const sesiones = await tx.query<{ id: string; ciclo_id: string; fecha: string; tipo: Sesion["tipo"]; actividad_id: string | null; tipo_actividad: string | null; cancelada: boolean; ventana_inicio: string | null; ventana_fin: string | null }>(`SELECT s.id,s.ciclo_id,s.fecha::text,s.tipo,s.actividad_id,a.tipo AS tipo_actividad,
    s.cancelada OR COALESCE(a.estado='cancelada',false) AS cancelada,s.ventana_inicio::text,s.ventana_fin::text
    FROM sesion s LEFT JOIN actividad_obligatoria a ON a.id=s.actividad_id WHERE s.ciclo_id=$1 AND s.eliminado_en IS NULL
    AND ($2::date IS NULL OR s.fecha>=$2) AND ($3::date IS NULL OR s.fecha<=$3) ORDER BY s.fecha,s.tipo,s.id`, [cicloId, filtro.desde ?? null, filtro.hasta ?? null]);
  const asistencias = await tx.query<{ sesion_id: string; catequizando_id: string; valor: ValorAsistencia }>("SELECT sesion_id,catequizando_id,valor FROM asistencia WHERE ciclo_id=$1 AND eliminado_en IS NULL AND ($2::uuid IS NULL OR catequizando_id=$2)", [cicloId, filtro.catequizandoId ?? null]);
  const listas = await tx.query<{ sesion_id: string; grupo_id: string }>("SELECT sesion_id,grupo_id FROM lista_asistencia WHERE ciclo_id=$1 AND estado='aceptada' AND eliminado_en IS NULL", [cicloId]);
  const estados: EstadoPorSesion[] = [];
  const parametros = await leerParametros(cicloId, tx);
  const activosPorFecha = new Map<string, Awaited<ReturnType<ReturnType<typeof obtenerFuenteInscripciones>["activosEnFecha"]>>>();
  for (const fila of sesiones.rows) {
    if (filtro.tipo && fila.tipo !== filtro.tipo) continue;
    const sesion: Sesion = { id: fila.id, cicloId: fila.ciclo_id, fecha: fila.fecha, tipo: fila.tipo, actividadId: fila.actividad_id, tipoActividad: fila.tipo_actividad ?? undefined, cancelada: fila.cancelada, ventanaInicio: fila.ventana_inicio, ventanaFin: fila.ventana_fin };
    if (!activosPorFecha.has(fila.fecha)) activosPorFecha.set(fila.fecha, await obtenerFuenteInscripciones().activosEnFecha(cicloId, fila.fecha, tx));
    const activos = activosPorFecha.get(fila.fecha)!;
    const ids = filtro.catequizandoId ? [filtro.catequizandoId] : activos.map(nino => nino.catequizandoId);
    for (const catequizandoId of ids) {
      const nino = activos.find(nino => nino.catequizandoId === catequizandoId);
      const asistencia = asistencias.rows.find(asistencia => asistencia.sesion_id === sesion.id && asistencia.catequizando_id === catequizandoId);
      const listaConfirmada = Boolean(nino && listas.rows.some(lista => lista.sesion_id === sesion.id && lista.grupo_id === nino.grupoId));
      estados.push({ sesion, catequizandoId, estado: estadoEnSesion(sesion, Boolean(nino), asistencia?.valor, listaConfirmada, filtro.ahora ?? Date.now(), parametros) });
    }
  }
  return estados;
}
export async function consultarAusencias(cicloId: string, filtro: FiltroAsistencia = {}, tx?: Tx): Promise<EstadoPorSesion[]> {
  if (!tx) return enTransaccion(transaccion => consultarAusencias(cicloId, filtro, transaccion));
  return ausenciasDelCiclo(await consultarEstados(cicloId, filtro, tx));
}
export async function consultarFaltas(cicloId: string, filtro: FiltroAsistencia = {}, tx?: Tx): Promise<Falta[]> {
  if (!tx) return enTransaccion(transaccion => consultarFaltas(cicloId, filtro, transaccion));
  const estados = await consultarEstados(cicloId, filtro, tx);
  return faltasDelCiclo(estados, await obtenerFuenteJustificaciones().consultar(cicloId, tx), obtenerActividadSumaFalta());
}
export async function consultarResumenAsistencia(catequizandoId: string, cicloId: string, tx?: Tx): Promise<{ domingos: { fecha: string; misa: string; catequesis: string }[]; ausencias: number; faltas: number }> {
  if (!tx) return enTransaccion(transaccion => consultarResumenAsistencia(catequizandoId, cicloId, transaccion));
  const estados = await consultarEstados(cicloId, { catequizandoId }, tx);
  const fechas = [...new Set(estados.filter(fila => fila.sesion.tipo !== "actividad").map(fila => fila.sesion.fecha))];
  const faltas = faltasDelCiclo(estados, await obtenerFuenteJustificaciones().consultar(cicloId, tx), obtenerActividadSumaFalta());
  return { domingos: fechas.map(fecha => ({ fecha, misa: estados.find(fila => fila.sesion.fecha === fecha && fila.sesion.tipo === "misa")?.estado ?? "no_aplica", catequesis: estados.find(fila => fila.sesion.fecha === fecha && fila.sesion.tipo === "catequesis")?.estado ?? "no_aplica" })), ausencias: ausenciasDelCiclo(estados).length, faltas: faltas.filter(falta => !falta.justificada).length };
}
