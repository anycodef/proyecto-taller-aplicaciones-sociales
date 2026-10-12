import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { CambiosTabla } from "@/lib/sincronizacion/protocolo";
import type { Tx } from "../../../compartido/bd/transaccion";
export interface PeticionProveedor {
  cuenta: ContextoAcceso; cicloId: string; desde: number | null; hasta: number;
}
export interface ProveedorSincronizacion {
  tablas: string[];
  pull(peticion: PeticionProveedor, tx: Tx): Promise<Record<string, CambiosTabla>>;
}
const proveedores: ProveedorSincronizacion[] = [];
export function registrarProveedor(proveedor: ProveedorSincronizacion): void {
  if (proveedores.some(otro => otro.tablas.some(tabla => proveedor.tablas.includes(tabla)))) throw new Error("Proveedor de sincronización duplicado");
  proveedores.push(proveedor);
}
export const obtenerProveedores = (): ProveedorSincronizacion[] => [...proveedores];
