import type { DefinicionTablaSincronizada } from "@/lib/sincronizacion/tablas";
export const tablaActividades: DefinicionTablaSincronizada = {
  nombre: "actividades_obligatorias", tablaSql: "actividad_obligatoria", sentido: "ambos", alcance: "ciclo", permiteActualizaciones: true,
  columnas: { ciclo_id: "string", nombre: "string", tipo: "string", fecha: "string", estado: "string", creado_por: "string", cuenta_id: "string", credencial_id: "string", dispositivo_id: "string" },
  columnasOpcionales: ["creado_por", "cuenta_id", "credencial_id", "dispositivo_id"],
};
