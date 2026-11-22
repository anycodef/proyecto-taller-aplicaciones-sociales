import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { FilaSincronizada } from "@/lib/sincronizacion/protocolo";
import { puedeConfigurarSesiones } from "./autorizacion";
import type { FilaSesionPendiente, Pendientes } from "./pendientes";
import { aSesion } from "./sesiones";
import type { Sesion } from "./tipos";

export type CambioSesion = {
  cancelada: boolean;
  motivoCancelacion?: string | null;
  ventanaInicio?: string | null;
  ventanaFin?: string | null;
};

export type ResultadoCambioSesion =
  | { ok: true; fila: FilaSesionPendiente }
  | { ok: false; error: "no_autorizado" | "motivo_requerido" | "hora_invalida" | "ventana_invalida" | "sin_dispositivo" };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Cambio de un domingo hecho por la coordinación: sin misa o sin catequesis
 * con motivo, o una ventana distinta. Queda en el celular hasta sincronizar,
 * como cualquier escritura operativa (RF-301, principio 5).
 */
export function cambiarSesion(cuenta: ContextoAcceso, sesion: Sesion, cambio: CambioSesion): ResultadoCambioSesion {
  if (!puedeConfigurarSesiones(cuenta)) return { ok: false, error: "no_autorizado" };
  if (!cuenta.dispositivoId) return { ok: false, error: "sin_dispositivo" };
  const motivo = cambio.motivoCancelacion?.trim() ?? "";
  if (cambio.cancelada && !motivo) return { ok: false, error: "motivo_requerido" };

  const inicio = cambio.ventanaInicio === undefined ? sesion.ventanaInicio ?? null : cambio.ventanaInicio || null;
  const fin = cambio.ventanaFin === undefined ? sesion.ventanaFin ?? null : cambio.ventanaFin || null;
  for (const hora of [inicio, fin]) {
    if (hora !== null && !HORA.test(hora.slice(0, 5))) return { ok: false, error: "hora_invalida" };
  }
  if ((inicio === null) !== (fin === null) || (inicio && fin && inicio.slice(0, 5) >= fin.slice(0, 5))) {
    return { ok: false, error: "ventana_invalida" };
  }

  return {
    ok: true,
    fila: {
      id: sesion.id,
      ciclo_id: sesion.cicloId,
      fecha: sesion.fecha,
      tipo: sesion.tipo,
      actividad_id: sesion.actividadId ?? null,
      ventana_inicio: inicio ? inicio.slice(0, 5) : null,
      ventana_fin: fin ? fin.slice(0, 5) : null,
      cancelada: cambio.cancelada,
      motivo_cancelacion: cambio.cancelada ? motivo : null,
      actualizado_por: cuenta.cuentaId,
      cuenta_id: cuenta.cuentaId,
      credencial_id: cuenta.credencialId,
      dispositivo_id: cuenta.dispositivoId,
    },
  };
}

/** Sesiones del celular con los cambios aún no enviados encima (lo último que decidió la coordinación). */
export function sesionesVigentes(descargadas: FilaSincronizada[], pendientes: Pendientes): (Sesion & { porEnviar: boolean })[] {
  const cambios = new Map(pendientes.sesiones.map((sesion) => [sesion.id, sesion.fila]));
  return descargadas.map((fila) => {
    const cambio = cambios.get(fila.id);
    return { ...aSesion(cambio ? { ...fila, ...cambio } : fila), porEnviar: Boolean(cambio) };
  });
}

export const ERRORES_CAMBIO_SESION: Record<Exclude<ResultadoCambioSesion, { ok: true }>["error"], string> = {
  no_autorizado: "Solo la coordinación cambia los domingos.",
  motivo_requerido: "Escribe el motivo para marcar la sesión sin realizar.",
  hora_invalida: "Usa horas como 07:30.",
  ventana_invalida: "La hora de inicio debe ser anterior a la de cierre.",
  sin_dispositivo: "Este celular no está identificado. Vuelve a activar tu acceso.",
};
