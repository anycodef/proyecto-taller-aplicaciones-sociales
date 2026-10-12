import { consultar } from "../../../compartido/bd/pool";
import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
async function ejecutar(sql: string, parametros: unknown[], tx?: Tx): Promise<void> {
  if (tx) await tx.query(sql, parametros); else await consultar(sql, parametros);
}
export async function terminarDelegacionesVigentes(tx?: Tx): Promise<void> {
  await ejecutar("UPDATE delegacion SET revocada_en=now(),terminada_por_cierre=true WHERE revocada_en IS NULL AND hasta>now()", [], tx);
}
export async function revocarEnlacesFamilia(cuentaIds: string[], tx?: Tx): Promise<void> {
  await ejecutar("UPDATE credencial SET estado='terminada',terminada_en=now(),motivo_fin='cierre_ciclo' WHERE cuenta_id=ANY($1::uuid[]) AND tipo='familia' AND estado<>'terminada'", [cuentaIds], tx);
}
export async function recalcularMinoria(inicioCiclo: string, tx?: Tx): Promise<void> {
  // Solo retención puede acceder directamente a identidad_real; contexto fijo, nunca de HTTP.
  const operacion = async (conexion: Tx) => {
    await conexion.query("SET LOCAL ROLE sigecat_retencion");
    await conexion.query("SELECT set_config('sigecat.contexto','retencion',true)");
    await conexion.query("UPDATE cuenta c SET es_menor=(i.fecha_nacimiento+interval '18 years'>$1::date) FROM identidad_real i WHERE i.cuenta_id=c.id AND i.fecha_nacimiento IS NOT NULL", [inicioCiclo]);
  };
  if (tx) await operacion(tx); else await enTransaccion(operacion);
}
