import { enTransaccion } from "../../../compartido/bd/transaccion";
import type { AlmacenEvidencias, RepositorioEvidencias } from "../dominio/puertos";
import { obtenerAlmacenEvidencias } from "../infraestructura/almacen";
import { repositorioEvidenciasPg } from "../infraestructura/repositorio-evidencias-pg";

/** Todos los días a las 03:00 de Lima; Functions programa en UTC (D-412). */
export const CRON_LIMPIAR_HUERFANAS = "0 0 8 * * *";

/**
 * Reservas sin confirmar de más de 24 h: la familia abandonó el envío. Cada una va en su propia
 * transacción con la fila bloqueada, así un lote que la confirma a la vez no pierde sus fotos.
 * Si Blob falla, la fila sigue reservada y se reintenta al día siguiente.
 */
export async function limpiarEvidenciasHuerfanas(ahora: Date, repo: RepositorioEvidencias = repositorioEvidenciasPg, almacen: () => AlmacenEvidencias = obtenerAlmacenEvidencias): Promise<{ eliminadas: number; blobs: number }> {
  const candidatas = await enTransaccion(tx => repo.listarHuerfanas(tx, ahora));
  let eliminadas = 0, blobs = 0;
  for (const evidencia of candidatas) {
    await enTransaccion(async tx => {
      const bloqueada = await tx.query("SELECT 1 FROM evidencia WHERE id=$1 AND estado='reservada' FOR UPDATE SKIP LOCKED", [evidencia.id]);
      if (!bloqueada.rowCount) return;
      blobs += await almacen().borrarPrefijo(`${evidencia.cicloId}/${evidencia.id}/`);
      if (await repo.marcarEliminada(tx, evidencia.id, "huerfana")) eliminadas++;
    });
  }
  return { eliminadas, blobs };
}
