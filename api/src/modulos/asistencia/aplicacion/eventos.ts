import { consultar } from "../../../compartido/bd/pool";
export async function leerEventosAsistencia(desdeSecuencia: number, limite = 100) {
  if (!Number.isSafeInteger(desdeSecuencia) || desdeSecuencia < 0 || !Number.isInteger(limite) || limite < 1 || limite > 1000) throw new Error("Cursor inválido");
  const resultado = await consultar<{ secuencia: string; tipo: string; ciclo_id: string; catequizando_id: string | null; fecha: string; creado_en: Date }>("SELECT secuencia,tipo,ciclo_id,catequizando_id,fecha::text,creado_en FROM evento_asistencia WHERE secuencia>$1 ORDER BY secuencia LIMIT $2", [desdeSecuencia, limite]);
  return resultado.rows.map(fila => ({ secuencia: Number(fila.secuencia), tipo: fila.tipo, cicloId: fila.ciclo_id, catequizandoId: fila.catequizando_id, fecha: fila.fecha, creadoEn: fila.creado_en.toISOString() }));
}
