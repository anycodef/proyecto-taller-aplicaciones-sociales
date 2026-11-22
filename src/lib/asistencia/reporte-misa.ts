import type { AsistenciaConsolidada } from "./tipos";
export function armarReporteMisa(asistencias: (AsistenciaConsolidada & { catequizandoId: string; nombre: string })[], totalActivos: number, identidadOperativa: (cuentaId: string) => string) {
  const presentes = asistencias.filter(fila => fila.valor === "presente").map(fila => ({
    catequizandoId: fila.catequizandoId, nombre: fila.nombre, horaDispositivo: fila.horaPrimerRegistro,
    recibidoEn: fila.recibidoPrimerRegistro, tipoRegistro: fila.tipoRegistro,
    registradores: fila.registradores.map(identidadOperativa),
  }));
  return { presentes, totalPresentes: presentes.length, totalActivos, totalManuales: presentes.filter(fila => fila.tipoRegistro === "manual").length };
}

/** Domingo de la fecha dada o el anterior: el reporte que se consulta por defecto (RF-312). */
export function domingoDeReferencia(fecha: string): string {
  const dia = Date.parse(`${fecha}T00:00:00Z`);
  if (!Number.isFinite(dia)) throw new Error("Fecha inválida");
  const atras = new Date(dia).getUTCDay();
  return new Date(dia - atras * 86400000).toISOString().slice(0, 10);
}

/** Reporte de misa tal como lo devuelve GET /asistencia/misas/{fecha}/reporte. */
export type ReporteMisa = {
  fecha: string;
  cancelada: boolean;
  totalPresentes: number;
  totalActivos: number;
  totalManuales: number;
  presentes: {
    catequizandoId: string;
    nombre: string;
    horaDispositivo: string;
    recibidoEn: string;
    tipoRegistro: "escaneo" | "manual" | "lista";
    registradores: string[];
  }[];
};
