import type { DefinicionTablaSincronizada } from "@/lib/sincronizacion/tablas";
export const tablaCiclos: DefinicionTablaSincronizada = { nombre: "ciclos", tablaSql: "ciclo", sentido: "pull", alcance: "ciclo", permiteActualizaciones: false, columnas: { nombre: "string", fecha_inicio: "string", fecha_fin: "string", estado: "string" } };
