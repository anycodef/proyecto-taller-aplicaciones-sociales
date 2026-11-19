import type { RespuestaAsistente } from "@/lib/asistente";
import { incrementarContador } from "../../../compartido/http/limites";

const VENTANA_METRICAS_SEGUNDOS = 24 * 60 * 60;

function tipoDeRespuesta(respuesta: RespuestaAsistente): "respuesta" | "abstencion" | "rechazo" {
  if (respuesta.proveedor === "guardia") return "rechazo";
  if (respuesta.modelo === "abstencion" || respuesta.fuentes.length === 0) return "abstencion";
  return "respuesta";
}

function etiquetaSegura(valor: string): string {
  return valor.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

/**
 * Métricas agregadas por cuenta/día en el contador existente. Nunca recibe la pregunta ni la respuesta:
 * solo tipo, proveedor y latencia, para no guardar contenido pastoral ni datos de niños.
 */
export async function registrarMetricasAsistente(
  cuentaId: string,
  respuesta: RespuestaAsistente,
  latenciaMs: number,
): Promise<void> {
  const tipo = tipoDeRespuesta(respuesta);
  const proveedor = etiquetaSegura(respuesta.proveedor);
  const latencia = Math.max(0, Math.round(Number.isFinite(latenciaMs) ? latenciaMs : 0));

  await Promise.all([
    incrementarContador(cuentaId, "asistente:consultas", VENTANA_METRICAS_SEGUNDOS),
    incrementarContador(cuentaId, `asistente:tipo:${tipo}`, VENTANA_METRICAS_SEGUNDOS),
    incrementarContador(cuentaId, `asistente:proveedor:${proveedor}`, VENTANA_METRICAS_SEGUNDOS),
    incrementarContador(cuentaId, "asistente:latencia_ms", VENTANA_METRICAS_SEGUNDOS, latencia || 1),
  ]);
}
