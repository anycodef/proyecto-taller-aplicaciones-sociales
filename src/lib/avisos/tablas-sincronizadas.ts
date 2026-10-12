import type { DefinicionTablaSincronizada } from "@/lib/sincronizacion/tablas";
export const tablaAvisos: DefinicionTablaSincronizada = {
  nombre: "avisos_grupo", tablaSql: "aviso_grupo", sentido: "pull", alcance: "mis_grupos", permiteActualizaciones: false,
  columnas: { grupo_id: "string", texto: "string", autor_visible: "string", publicado_en: "number" },
};
