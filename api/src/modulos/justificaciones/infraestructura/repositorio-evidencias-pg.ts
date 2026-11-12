import type { Tx } from "../../../compartido/bd/transaccion";
import { HORAS_RESERVA_HUERFANA, VENTANA_LIMITE_RESERVAS_MS, type ArchivoGuardado, type Evidencia, type RepositorioEvidencias } from "../dominio/puertos";

type FilaEvidencia = { id: string; ciclo_id: string; subida_por: string; estado: Evidencia["estado"]; reservada_en: Date; confirmada_en: Date | null };
const COLUMNAS = "id,ciclo_id,subida_por,estado,reservada_en,confirmada_en";

async function conArchivos(tx: Tx, filas: FilaEvidencia[]): Promise<Evidencia[]> {
  if (!filas.length) return [];
  const archivos = await tx.query<{ evidencia_id: string; orden: number; blob_nombre: string; bytes: number; content_type: string }>(
    "SELECT evidencia_id,orden,blob_nombre,bytes,content_type FROM evidencia_archivo WHERE evidencia_id=ANY($1::uuid[]) ORDER BY orden", [filas.map(f => f.id)]);
  return filas.map(f => ({
    id: f.id, cicloId: f.ciclo_id, subidaPor: f.subida_por, estado: f.estado,
    reservadaEn: f.reservada_en.toISOString(), confirmadaEn: f.confirmada_en?.toISOString() ?? null,
    archivos: archivos.rows.filter(a => a.evidencia_id === f.id).map(a => ({ orden: a.orden, blobNombre: a.blob_nombre, bytes: a.bytes, contentType: a.content_type })),
  }));
}

export const repositorioEvidenciasPg: RepositorioEvidencias = {
  async reservar(tx, { id, cicloId, subidaPor, en }) {
    await tx.query("INSERT INTO evidencia(id,ciclo_id,subida_por,reservada_en) VALUES($1,$2,$3,$4)", [id, cicloId, subidaPor, en]);
  },
  async confirmar(tx, id, archivos: readonly ArchivoGuardado[], en) {
    const confirmada = await tx.query("UPDATE evidencia SET estado='confirmada',confirmada_en=$2 WHERE id=$1 AND estado='reservada'", [id, en]);
    if (!confirmada.rowCount) return false;
    for (const a of archivos) {
      await tx.query("INSERT INTO evidencia_archivo(evidencia_id,orden,blob_nombre,bytes,content_type) VALUES($1,$2,$3,$4,$5)", [id, a.orden, a.blobNombre, a.bytes, a.contentType]);
    }
    return true;
  },
  async obtener(tx, id) {
    const filas = await tx.query<FilaEvidencia>(`SELECT ${COLUMNAS} FROM evidencia WHERE id=$1`, [id]);
    return (await conArchivos(tx, filas.rows))[0];
  },
  async listarHuerfanas(tx, ahora) {
    const limite = new Date(ahora.getTime() - HORAS_RESERVA_HUERFANA * 60 * 60 * 1000);
    const filas = await tx.query<FilaEvidencia>(`SELECT ${COLUMNAS} FROM evidencia WHERE estado='reservada' AND reservada_en<$1 ORDER BY reservada_en`, [limite]);
    return conArchivos(tx, filas.rows);
  },
  async contarReservasRecientes(tx, cuentaId, ahora) {
    const desde = new Date(ahora.getTime() - VENTANA_LIMITE_RESERVAS_MS);
    const fila = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM evidencia WHERE subida_por=$1 AND reservada_en>$2", [cuentaId, desde]);
    return fila.rows[0].n;
  },
  async marcarEliminada(tx, id, motivo) {
    const fila = await tx.query<{ hecho: boolean }>("SELECT marcar_evidencia_eliminada($1,$2) AS hecho", [id, motivo]);
    return fila.rows[0].hecho;
  },
};
