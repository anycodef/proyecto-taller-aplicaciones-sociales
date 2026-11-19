import type { DefinicionTablaSincronizada } from "@/lib/sincronizacion/tablas";

/**
 * Solo el estado visible por ausencia: causa, motivo, quien envió y evidencia nunca llegan al
 * dispositivo (D-408, RNF-101). Es de solo lectura: el push no la acepta.
 */
export const tablaJustificacionesEstado: DefinicionTablaSincronizada = {
  nombre: "justificaciones_estado", tablaSql: "justificacion", sentido: "pull", alcance: "mis_grupos", permiteActualizaciones: false,
  columnas: { catequizando_id: "string", sesion_id: "string", fecha: "string", tipo_sesion: "string", estado: "string" },
};
