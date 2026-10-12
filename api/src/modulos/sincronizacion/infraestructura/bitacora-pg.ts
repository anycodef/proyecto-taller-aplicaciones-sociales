import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { ResumenPush } from "@/lib/sincronizacion/protocolo";
import { consultar } from "../../../compartido/bd/pool";
import type { Tx } from "../../../compartido/bd/transaccion";
export async function registrarBitacora(cuenta: ContextoAcceso, operacion: "pull" | "push", inicio: number, bytesEntrada: number, bytesSalida: number, versionEsquema: number, resumen?: ResumenPush, tx?: Tx): Promise<void> {
  const ejecutar = tx ? tx.query.bind(tx) : consultar;
  await ejecutar(`INSERT INTO bitacora_sincronizacion(cuenta_id,dispositivo_id,operacion,duracion_ms,bytes_entrada,bytes_salida,aceptados,rechazados,descartados_cierre,version_esquema)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [cuenta.cuentaId, cuenta.dispositivoId ?? null, operacion, Math.max(0, Date.now() - inicio), bytesEntrada, bytesSalida, resumen?.aceptados ?? 0, resumen?.rechazados ?? 0, resumen?.descartadosCierre ?? 0, versionEsquema]);
}
