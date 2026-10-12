import { createHash } from "node:crypto";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
export function huella(valor: unknown): string {
  function ordenar(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, dato]) => [k, ordenar(dato)]));
    return v;
  }
  return createHash("sha256").update(JSON.stringify(ordenar(valor))).digest("hex");
}
export async function cicloAbierto(tx: Tx, cicloId?: string): Promise<{ id: string; inicio: string }> {
  const r = await tx.query<{ id: string; inicio: string }>("SELECT id,inicio::text FROM ciclo WHERE estado='abierto' AND ($1::uuid IS NULL OR id=$1) FOR SHARE", [cicloId ?? null]);
  if (r.rows.length !== 1) throw new ErrorAplicacion(409, "ciclo_no_abierto");
  return r.rows[0];
}
export async function bloquearNino(tx: Tx, id: string): Promise<void> {
  const r = await tx.query("SELECT id FROM catequizando WHERE id=$1 AND estado<>'anonimizado' FOR UPDATE", [id]);
  if (!r.rowCount) throw new ErrorAplicacion(403, "fuera_de_alcance");
}
export async function cambio(tx: Tx, datos: { id: string; catequizandoId: string; entidad: string; entidadId: string; campo: string; anterior: unknown; nuevo: unknown; cuentaId: string; motivo?: string }): Promise<void> {
  const anterior = JSON.stringify(datos.anterior ?? null), nuevo = JSON.stringify(datos.nuevo ?? null);
  const r = await tx.query("INSERT INTO cambio_inscripcion(id,catequizando_id,entidad,entidad_id,campo,valor_anterior,valor_nuevo,cambiado_por,motivo) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9) ON CONFLICT(id) DO NOTHING", [datos.id, datos.catequizandoId, datos.entidad, datos.entidadId, datos.campo, anterior, nuevo, datos.cuentaId, datos.motivo ?? null]);
  if (!r.rowCount) {
    const existente = await tx.query("SELECT id FROM cambio_inscripcion WHERE id=$1 AND catequizando_id=$2 AND entidad=$3 AND entidad_id=$4 AND campo=$5 AND valor_anterior=$6::jsonb AND valor_nuevo=$7::jsonb AND cambiado_por=$8 AND motivo IS NOT DISTINCT FROM $9", [datos.id, datos.catequizandoId, datos.entidad, datos.entidadId, datos.campo, anterior, nuevo, datos.cuentaId, datos.motivo ?? null]);
    if (!existente.rowCount) throw new ErrorAplicacion(409, "uuid_en_conflicto");
  }
}
