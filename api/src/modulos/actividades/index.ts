import { registrarProveedor } from "../sincronizacion/aplicacion/registro-proveedores";
import { proveedorActividades } from "./infraestructura/proveedor-sincronizacion";
import { registrarHttpActividades } from "./http";
import { actividadSumaFalta } from "@/lib/actividades/falta-actividad";
import { registrarActividadSumaFalta } from "../asistencia/dominio/puertos";
export { proveedorActividades } from "./infraestructura/proveedor-sincronizacion";
export { procesarActividad } from "./aplicacion/procesar-actividad";
let registrado = false;
export function registrarActividades(): void {
  if (registrado) return; registrado = true;
  registrarProveedor(proveedorActividades); registrarHttpActividades();
  registrarActividadSumaFalta(sesion => sesion.tipoActividad === "jornada" && actividadSumaFalta({ tipo: "jornada", estado: sesion.cancelada ? "cancelada" : "vigente" }));
}
