export const DIAS_CONSERVACION_AUDITORIA = 730;
export function pieExportacion(cierreCiclo: string): string {
  return `Contiene datos de menores; elimínese al cierre del ciclo + 2 años (${fechaVencimientoRetencion(cierreCiclo).toISOString().slice(0, 10)}).`;
}
export function fechaVencimientoRetencion(cierre: string): Date {
  const fecha = new Date(cierre);
  const mes = fecha.getUTCMonth();
  fecha.setUTCFullYear(fecha.getUTCFullYear() + 2);
  if (fecha.getUTCMonth() !== mes) fecha.setUTCDate(0);
  return fecha;
}
export function ciclosPorAnonimizar(ciclos: { id: string; cerradoEn: string | null }[], hoy: Date, ejecutados: string[]): string[] {
  return ciclos.filter(c => c.cerradoEn && !ejecutados.includes(c.id) && fechaVencimientoRetencion(c.cerradoEn).getTime() <= hoy.getTime()).map(c => c.id);
}
