import { createHash } from "node:crypto";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { huellaAlcance } from "@/lib/sincronizacion/alcance";
import type { CambiosPorTabla, RespuestaPull } from "@/lib/sincronizacion/protocolo";
import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { consultarNomina, proveedorAsistencia } from "../../asistencia/infraestructura/proveedor-sincronizacion";
import { obtenerProveedores } from "./registro-proveedores";
import { obtenerTablas } from "@/lib/sincronizacion/registro-tablas";
import { incorporarLapidas } from "../../asistencia/infraestructura/lapidas-sincronizacion";
export interface EntradaPull { ultimoPulso: number | null; versionEsquema: number; huellaAlcance?: string | null; migracion?: { tablas: string[]; columnas?: { tabla: string; columnas: string[] }[] } }
export async function aplicarPull(entrada: EntradaPull, cuenta: ContextoAcceso, tx: Tx): Promise<RespuestaPull> {
  if (entrada.versionEsquema !== 1 || (entrada.ultimoPulso !== null && (!Number.isSafeInteger(entrada.ultimoPulso) || entrada.ultimoPulso < 0 || entrada.ultimoPulso > Date.now()))) throw new ErrorAplicacion(422, "esquema_sincronizacion_invalido");
  const sello = await tx.query<{ timestamp: string }>("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS timestamp");
  const timestamp = Number(sello.rows[0].timestamp);
  const ciclo = await tx.query<{ id: string }>("SELECT id FROM ciclo WHERE estado='abierto' ORDER BY inicio DESC LIMIT 1");
  const cicloId = ciclo.rows[0]?.id ?? "";
  const nomina = cicloId ? await consultarNomina(cicloId, tx) : [];
  const revision = createHash("sha256").update(JSON.stringify(nomina.map(fila => [fila.id, fila.grupo_id]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))).digest("hex");
  const huella = huellaAlcance(cuenta, cicloId, revision);
  const reemplazo = entrada.ultimoPulso === null || entrada.huellaAlcance !== huella;
  const proveedores = [proveedorAsistencia, ...obtenerProveedores()];
  const nombres = proveedores.flatMap(proveedor => proveedor.tablas);
  if (new Set(nombres).size !== nombres.length) throw new Error("Proveedor de sincronización duplicado");
  const completas = new Set([...(entrada.migracion?.tablas ?? []), ...(entrada.migracion?.columnas?.map(columna => columna.tabla) ?? [])]);
  if ([...completas].some(tabla => !nombres.includes(tabla))) throw new ErrorAplicacion(422, "migracion_desconocida");
  for (const cambio of entrada.migracion?.columnas ?? []) {
    const definicion = obtenerTablas().find(tabla => tabla.nombre === cambio.tabla);
    if (!definicion || cambio.columnas.some(columna => !(columna in definicion.columnas))) throw new ErrorAplicacion(422, "migracion_desconocida");
  }
  const changes: CambiosPorTabla = {};
  if (cicloId) {
    for (const proveedor of proveedores) {
      const parciales = await proveedor.pull({ cuenta, cicloId, desde: reemplazo ? null : Math.max(0, entrada.ultimoPulso! - 60000), hasta: timestamp }, tx);
      Object.assign(changes, parciales);
      if (!reemplazo && proveedor.tablas.some(tabla => completas.has(tabla))) {
        const totales = await proveedor.pull({ cuenta, cicloId, desde: null, hasta: timestamp }, tx);
        for (const tabla of proveedor.tablas.filter(tabla => completas.has(tabla))) changes[tabla] = totales[tabla];
      }
    }
  } else for (const tabla of nombres) changes[tabla] = { created: [], updated: [], deleted: [] };
  await incorporarLapidas(changes, cuenta, reemplazo ? null : Math.max(0, entrada.ultimoPulso! - 60000), timestamp, tx);
  return { changes, timestamp, ...(reemplazo ? { experimentalStrategy: "replacement" as const } : {}), huellaAlcance: huella };
}
export const pull = (entrada: EntradaPull, cuenta: ContextoAcceso): Promise<RespuestaPull> => enTransaccion(async tx => {
  await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  return aplicarPull(entrada, cuenta, tx);
});
