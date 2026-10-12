import type { Tx } from "../../../compartido/bd/transaccion";
import { consolidar } from "@/lib/asistencia/consolidacion";
import { idAsistencia } from "@/lib/asistencia/sesiones";
import { crearAviso, leerCorrecciones, leerMarcas, leerSesion } from "../infraestructura/repositorio-pg";
import { notificarCambio } from "../dominio/puertos";
export async function bloquearPares(pares: { sesionId: string; catequizandoId: string }[], tx: Tx): Promise<void> {
  for (const clave of [...new Set(pares.map(par => `${par.sesionId}:${par.catequizandoId}`))].sort()) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [clave]);
  }
}
export async function consolidarPar(sesionId: string, catequizandoId: string, tx: Tx): Promise<void> {
  const marcas = await leerMarcas(sesionId, catequizandoId, tx);
  const correcciones = await leerCorrecciones(sesionId, catequizandoId, tx);
  const consolidada = consolidar(marcas, correcciones);
  if (!consolidada) return;
  const sesion = await leerSesion(sesionId, tx);
  if (!sesion) return;
  const anterior = await tx.query<{ valor: string }>("SELECT valor FROM asistencia WHERE sesion_id=$1 AND catequizando_id=$2", [sesionId, catequizandoId]);
  await tx.query(`INSERT INTO asistencia(id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,hora_primer_registro,recibido_primer_registro,corregida,conflicto)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(sesion_id,catequizando_id) DO UPDATE SET
    valor=EXCLUDED.valor,tipo_registro=EXCLUDED.tipo_registro,hora_primer_registro=EXCLUDED.hora_primer_registro,
    recibido_primer_registro=EXCLUDED.recibido_primer_registro,corregida=EXCLUDED.corregida,conflicto=EXCLUDED.conflicto`,
  [idAsistencia(sesionId, catequizandoId), sesion.cicloId, sesionId, catequizandoId, consolidada.valor, consolidada.tipoRegistro, consolidada.horaPrimerRegistro, consolidada.recibidoPrimerRegistro, consolidada.corregida, consolidada.conflicto]);
  if (anterior.rows[0]?.valor !== consolidada.valor) {
    await tx.query("INSERT INTO evento_asistencia(tipo,ciclo_id,catequizando_id,fecha) VALUES('valor_cambiado',$1,$2,$3)", [sesion.cicloId, catequizandoId, sesion.fecha]);
    await notificarCambio({ cicloId: sesion.cicloId, catequizandoId, fecha: sesion.fecha }, tx);
  }
  if (consolidada.conflicto) await crearAviso(tx, { tipo: "conflicto_registro", cicloId: sesion.cicloId, sesionId, catequizandoId, referencia: catequizandoId });
}
export async function revisarCruce(cicloId: string, fecha: string, tx: Tx): Promise<void> {
  const resultado = await tx.query<{ catequizando_id: string; sesion_id: string }>(`SELECT am.catequizando_id,sc.id AS sesion_id
    FROM sesion sm JOIN asistencia am ON am.sesion_id=sm.id AND am.valor='presente'
    JOIN sesion sc ON sc.ciclo_id=sm.ciclo_id AND sc.fecha=sm.fecha AND sc.tipo='catequesis' AND NOT sc.cancelada
    JOIN asistencia ac ON ac.sesion_id=sc.id AND ac.catequizando_id=am.catequizando_id AND ac.valor='ausente'
    WHERE sm.ciclo_id=$1 AND sm.fecha=$2 AND sm.tipo='misa' AND NOT sm.cancelada
      AND EXISTS(SELECT 1 FROM marca_asistencia m JOIN lista_asistencia l ON l.id=m.lista_id
      WHERE m.sesion_id=sc.id AND m.catequizando_id=am.catequizando_id AND m.estado='aceptada' AND l.estado='aceptada')`, [cicloId, fecha]);
  for (const fila of resultado.rows) await crearAviso(tx, { tipo: "revision_cruzada", cicloId, sesionId: fila.sesion_id, catequizandoId: fila.catequizando_id, referencia: fila.catequizando_id });
}
