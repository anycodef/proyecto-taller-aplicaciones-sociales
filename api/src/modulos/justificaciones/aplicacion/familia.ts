import { ausenciasJustificables } from "@/lib/justificaciones/justificables";
import { fechaLimite } from "@/lib/justificaciones/plazo";
import { estadoVisible } from "@/lib/justificaciones/estados";
import type { AusenciaRef, Causa, EstadoVisible } from "@/lib/justificaciones/tipos";
import type { TipoSesion } from "@/lib/asistencia/tipos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { consultarAusencias } from "../../asistencia/aplicacion/consultar-faltas";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { repositorioJustificacionesPg } from "../infraestructura/repositorio-justificaciones-pg";

export type AusenciaJustificable = AusenciaRef & { nombre: string; venceEn: string };
export type JustificacionFamilia = {
  id: string;
  catequizandoId: string;
  nombre: string;
  fecha: string;
  tipoSesion: TipoSesion;
  causa: Causa;
  estadoVisible: EstadoVisible;
  motivoRechazo?: string;
  origen: "propia" | "otro_apoderado" | "coordinacion";
};

export async function nombresDe(tx: Tx, ids: readonly string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const filas = await tx.query<{ id: string; nombre: string }>(
    "SELECT id,nombres || ' ' || apellidos AS nombre FROM catequizando WHERE id=ANY($1::uuid[])",
    [[...new Set(ids)]],
  );
  return new Map(filas.rows.map((f) => [f.id, f.nombre]));
}

/** `enviada_por` apunta al apoderado, no a la cuenta que inició sesión. */
export async function apoderadoDeCuenta(tx: Tx, cuentaId: string): Promise<string> {
  const fila = await tx.query<{ id: string }>("SELECT id FROM apoderado WHERE cuenta_id=$1 ORDER BY id LIMIT 1", [cuentaId]);
  if (!fila.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  return fila.rows[0].id;
}

export type DatosJustificables = { cicloId: string; apoderadoId: string; ausencias: AusenciaRef[]; diasPlazo: number };

/** Ausencias de los hijos del apoderado aún dentro del plazo y sin justificación vigente (RF-401, RF-405, RF-408). */
export async function ausenciasJustificablesDe(ctx: ContextoAcceso, ahora: Date, tx: Tx): Promise<DatosJustificables | undefined> {
  const cicloId = await cicloAbierto(tx);
  if (!cicloId || !ctx.catequizandosApoderados.length) return undefined;
  const apoderadoId = await apoderadoDeCuenta(tx, ctx.cuentaId);
  const hijos = new Set(ctx.catequizandosApoderados);
  const estados = (await consultarAusencias(cicloId, { ahora: ahora.getTime() }, tx)).filter((e) => hijos.has(e.catequizandoId));
  const ausencias: AusenciaRef[] = estados.map((e) => ({
    catequizandoId: e.catequizandoId,
    sesionId: e.sesion.id,
    tipoSesion: e.sesion.tipo,
    fecha: e.sesion.fecha,
  }));
  const { diasPlazo } = await repositorioJustificacionesPg.obtenerPlazo(tx, cicloId);
  const existentes = await repositorioJustificacionesPg.listarPorApoderado(tx, apoderadoId);
  return { cicloId, apoderadoId, diasPlazo, ausencias: ausenciasJustificables(ausencias, existentes, diasPlazo, ahora) };
}

export async function listarJustificables(ctx: ContextoAcceso, ahora: Date, tx: Tx): Promise<{ ausencias: AusenciaJustificable[] }> {
  const datos = await ausenciasJustificablesDe(ctx, ahora, tx);
  if (!datos) return { ausencias: [] };
  const nombres = await nombresDe(tx, datos.ausencias.map((a) => a.catequizandoId));
  return {
    ausencias: datos.ausencias
      .map((a) => ({ ...a, nombre: nombres.get(a.catequizandoId) ?? "", venceEn: fechaLimite(a.fecha, datos.diasPlazo) }))
      .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.nombre.localeCompare(y.nombre)),
  };
}

/** Sin URL de evidencia ni identidad del otro apoderado (RF-410, supuesto A-14). */
export async function listarMisJustificaciones(ctx: ContextoAcceso, tx: Tx): Promise<{ justificaciones: JustificacionFamilia[] }> {
  const apoderadoId = await apoderadoDeCuenta(tx, ctx.cuentaId);
  const todas = await repositorioJustificacionesPg.listarPorApoderado(tx, apoderadoId);
  const nombres = await nombresDe(tx, todas.map((j) => j.catequizandoId));
  return {
    justificaciones: todas.map((j) => {
      const estado = estadoVisible(j);
      const origen: JustificacionFamilia["origen"] = j.canal === "coordinacion" ? "coordinacion" : j.enviadaPor === apoderadoId ? "propia" : "otro_apoderado";
      return {
        id: j.id,
        catequizandoId: j.catequizandoId,
        nombre: nombres.get(j.catequizandoId) ?? "",
        fecha: j.fecha,
        tipoSesion: j.tipoSesion,
        causa: j.causa,
        estadoVisible: estado,
        ...(estado === "rechazada" && j.motivoRechazo ? { motivoRechazo: j.motivoRechazo } : {}),
        origen,
      };
    }),
  };
}
