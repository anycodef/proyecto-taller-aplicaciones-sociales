import { registrarProveedor } from "../sincronizacion/aplicacion/registro-proveedores";
import { proveedorCiclos } from "./infraestructura/proveedor-sincronizacion";
import { registrarHttpCiclos } from "./http";
export { proveedorCiclos } from "./infraestructura/proveedor-sincronizacion";
export { cicloAbierto, asegurarCicloAbierto } from "./aplicacion/guardia-ciclo";
export { abrirCiclo, cerrarCiclo } from "./aplicacion/gestionar-ciclo";
let registrado = false;
export function registrarCiclos(): void {
  if (registrado) return; registrado = true;
  registrarProveedor(proveedorCiclos); registrarHttpCiclos();
}
