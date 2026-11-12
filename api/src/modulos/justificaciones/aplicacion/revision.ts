import { revisar, estadoVisible, type DecisionRevision } from "@/lib/justificaciones/estados";
import { ErrorJustificacion, type Causa, type EstadoVisible } from "@/lib/justificaciones/tipos";
import type { TipoSesion } from "@/lib/asistencia/tipos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { cicloAbierto } from "../../ciclos/aplicacion/guardia-ciclo";
import { auditar } from "../../seguridad";
import { repositorioJustificacionesPg } from "../infraestructura/repositorio-justificaciones-pg";
import { nombresDe } from "./familia";

export type JustificacionBandeja = {
  id: string;
  catequizandoId: string;
  nombre: string;
  fecha: string;
  tipoSesion: TipoSesion;
  causa: Causa;
  enviadaEn: string;
  canal: "enlace" | "coordinacion";
  duplicada: boolean;
};

/** Pendientes del ciclo agrupadas por lote, con el nombre del niño (RF-403, RF-408). */
export async function consultarBandeja(tx: Tx): Promise<{ lotes: { loteId: string; justificaciones: JustificacionBandeja[] }[] }> {
  const cicloId = await cicloAbierto(tx);
  if (!cicloId) return { lotes: [] };
  const lotes = await repositorioJustificacionesPg.bandeja(tx, cicloId);
  const nombres = await nombresDe(tx, lotes.flatMap((l) => l.justificaciones.map((j) => j.catequizandoId)));
  return {
    lotes: lotes.map((lote) => ({
      loteId: lote.loteId,
      justificaciones: lote.justificaciones.map((j) => ({
        id: j.id,
        catequizandoId: j.catequizandoId,
        nombre: nombres.get(j.catequizandoId) ?? "",
        fecha: j.fecha,
        tipoSesion: j.tipoSesion,
        causa: j.causa,
        enviadaEn: j.enviadaEn,
        canal: j.canal,
        duplicada: j.duplicada,
      })),
    })),
  };
}

const ESTADO_POR_CODIGO: Record<string, number> = { no_pendiente: 409, sin_efecto: 409, motivo_requerido: 422, motivo_largo: 422 };

/** Aprobar o rechazar es definitivo; una sola transacción deja la revisión completa o nada (RF-406). */
export async function revisarJustificaciones(
  ctx: ContextoAcceso,
  entrada: { justificacionIds: string[]; decision: DecisionRevision; motivo?: string },
  ahora: Date,
  tx: Tx,
): Promise<{ revisadas: { id: string; estadoVisible: EstadoVisible }[] }> {
  const revisadas: { id: string; estadoVisible: EstadoVisible }[] = [];
  for (const id of new Set(entrada.justificacionIds)) {
    const actual = await repositorioJustificacionesPg.obtener(tx, id);
    if (!actual) throw new ErrorAplicacion(404, "no_encontrada");
    try {
      const resultado = revisar(actual, entrada.decision, ctx.cuentaId, ahora.toISOString(), entrada.motivo);
      await repositorioJustificacionesPg.guardarRevision(tx, resultado);
      revisadas.push({ id, estadoVisible: estadoVisible(resultado) });
      await auditar(ctx, { accion: "justificacion:revisar", recursoTipo: "justificacion", recursoId: id, catequizandoId: actual.catequizandoId, resultado: "permitido" }, tx);
    } catch (error) {
      if (error instanceof ErrorJustificacion) throw new ErrorAplicacion(ESTADO_POR_CODIGO[error.codigo] ?? 422, error.codigo);
      throw error;
    }
  }
  return { revisadas };
}
