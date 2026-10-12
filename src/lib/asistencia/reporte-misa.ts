import type { AsistenciaConsolidada } from "./tipos";
export function armarReporteMisa(asistencias: (AsistenciaConsolidada & { catequizandoId: string; nombre: string })[], totalActivos: number, identidadOperativa: (cuentaId: string) => string) {
  const presentes = asistencias.filter(fila => fila.valor === "presente").map(fila => ({
    catequizandoId: fila.catequizandoId, nombre: fila.nombre, horaDispositivo: fila.horaPrimerRegistro,
    recibidoEn: fila.recibidoPrimerRegistro, tipoRegistro: fila.tipoRegistro,
    registradores: fila.registradores.map(identidadOperativa),
  }));
  return { presentes, totalPresentes: presentes.length, totalActivos, totalManuales: presentes.filter(fila => fila.tipoRegistro === "manual").length };
}
