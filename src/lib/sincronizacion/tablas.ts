export interface DefinicionTablaSincronizada {
  nombre: string; tablaSql: string; columnas: Record<string, "string" | "number" | "boolean">;
  columnasOpcionales?: string[];
  sentido: "pull" | "ambos"; alcance: "ciclo" | "mis_grupos" | "propias";
  permiteActualizaciones: boolean;
}
