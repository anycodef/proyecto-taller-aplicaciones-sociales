import type { Actividad } from "./catalogo-actividades";
export const actividadSumaFalta = (actividad: Pick<Actividad, "tipo" | "estado">): boolean => actividad.tipo === "jornada" && actividad.estado !== "cancelada";
