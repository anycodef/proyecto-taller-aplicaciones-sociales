const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** `2026-11-08` -> `8 nov`; la fecha civil se interpreta sin zona para no correrla un día. */
export function fechaCorta(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return fecha;
  return `${Number(partes[3])} ${MESES[Number(partes[2]) - 1]}`;
}

export const etiquetaSesion = (tipo: string): string => (tipo === "misa" ? "Misa" : tipo === "catequesis" ? "Catequesis" : "Actividad");
