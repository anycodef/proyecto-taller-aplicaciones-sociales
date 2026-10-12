import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
export type ProveedorResumenPerfil = { nombre: string; consultar(catequizandoId: string, cicloId: string, contexto: ContextoAcceso, tx: Tx): Promise<unknown> };
const proveedores = new Map<string, ProveedorResumenPerfil>();
export function registrarProveedorResumen(proveedor: ProveedorResumenPerfil): void {
  if (proveedores.has(proveedor.nombre) && proveedores.get(proveedor.nombre) !== proveedor) throw new Error("proveedor_duplicado");
  proveedores.set(proveedor.nombre, proveedor);
}
export async function resumenesPerfil(catequizandoId: string, cicloId: string, contexto: ContextoAcceso, tx: Tx): Promise<Record<string, unknown>> {
  const resultado: Record<string, unknown> = {};
  for (const proveedor of proveedores.values()) { const resumen = await proveedor.consultar(catequizandoId, cicloId, contexto, tx); if (resumen !== undefined) resultado[proveedor.nombre] = resumen; }
  return resultado;
}
export type PeriodoInscripcion = { inscripcionId: string; catequizandoId: string; cicloId: string; estado: "vigente" | "anulada"; desde: string; hasta: string | null; asignaciones: { grupoId: string; desde: string; hasta: string | null }[] };
export type FuenteInscripciones = { periodos(cicloId: string, catequizandoIds: string[], tx: Tx): Promise<PeriodoInscripcion[]> };
