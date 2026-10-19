import * as Crypto from "expo-crypto";

import type { ClienteHttp } from "@/plataforma/api/cliente";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { registrarIntento, verificadorPin } from "@/lib/seguridad/pin";
import { estadoSesionLocal, type EstadoSesion } from "@/lib/seguridad/sesion-local";

import { contextoAlmacenable, type AlmacenSesion, type SesionAlmacenada } from "./almacen-seguro";

export const LONGITUD_SAL_BYTES = 16;

export type RespuestaActivacionServidor = {
  jwt: string;
  contexto: ContextoAcceso;
  tokenRenovacion?: string;
  ultimaRenovacion?: string;
};

/** Activacion que aun no tiene PIN: no se guarda nada en el celular. */
export type ActivacionPendiente = {
  jwt: string;
  credencialId: string;
  tokenRenovacion?: string;
  ultimaRenovacion?: number;
  contexto: ContextoAcceso;
};

export type GestorSesionOpciones = {
  almacen: AlmacenSesion;
  cliente: ClienteHttp;
  generarSal?: () => string;
  calcularHash?: (valor: string) => Promise<string>;
  ahora?: () => number;
};

export type ResultadoDesbloqueo = {
  estado: EstadoSesion | "pin_invalido";
  intentosFallidos: number;
  sesion: SesionAlmacenada | null;
  bloqueoReportado: boolean;
};

export type GestorSesion = {
  activarEquipo(tokenEnlace: string): Promise<ActivacionPendiente>;
  fijarPin(activacion: ActivacionPendiente, pin: string): Promise<SesionAlmacenada>;
  desbloquear(cuentaId: string, pin: string): Promise<ResultadoDesbloqueo>;
};

function salPorDefecto(): string {
  const bytes = Crypto.getRandomBytes(LONGITUD_SAL_BYTES);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hashPorDefecto(valor: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, valor);
}

/**
 * Activacion del enlace del equipo y fijacion del PIN local.
 * El PIN nunca viaja al servidor: se verifica solo en el celular (D-103).
 */
export function crearGestorSesion(opciones: GestorSesionOpciones): GestorSesion {
  const { almacen, cliente } = opciones;
  const generarSal = opciones.generarSal ?? salPorDefecto;
  const calcularHash = opciones.calcularHash ?? hashPorDefecto;
  const ahora = opciones.ahora ?? (() => Date.now());

  async function activarEquipo(tokenEnlace: string): Promise<ActivacionPendiente> {
    const dispositivoId = await almacen.obtenerDispositivoId();
    const respuesta = await cliente.solicitar<RespuestaActivacionServidor>(
      "POST",
      "/acceso/equipo/activar",
      { token: tokenEnlace, dispositivoId }
    );

    return {
      jwt: respuesta.jwt,
      credencialId: respuesta.contexto.credencialId,
      tokenRenovacion: respuesta.tokenRenovacion,
      ultimaRenovacion: respuesta.ultimaRenovacion ? Date.parse(respuesta.ultimaRenovacion) : undefined,
      contexto: respuesta.contexto,
    };
  }

  async function fijarPin(activacion: ActivacionPendiente, pin: string): Promise<SesionAlmacenada> {
    const sal = generarSal();
    const hash = await verificadorPin(pin, sal, calcularHash);

    const sesion: SesionAlmacenada = {
      tipo: "equipo",
      cuentaId: activacion.contexto.cuentaId,
      credencialId: activacion.credencialId,
      tokenRenovacion: activacion.tokenRenovacion,
      ultimaRenovacionServidor: activacion.ultimaRenovacion,
      instanteMaximoVisto: ahora(),
      pinSal: sal,
      pinHash: hash,
      intentosFallidos: 0,
      bloqueada: false,
      contexto: contextoAlmacenable(activacion.contexto),
    };

    await almacen.guardarSesion(sesion);
    return sesion;
  }

  /**
   * Reporta el bloqueo al servidor. Sin red la llamada falla y el bloqueo
   * local se mantiene igual: el enlace queda terminado para el servidor.
   */
  async function reportarBloqueo(tokenRenovacion: string): Promise<boolean> {
    try {
      const dispositivoId = await almacen.obtenerDispositivoId();
      await cliente.solicitar("POST", "/acceso/bloqueo", { tokenRenovacion, dispositivoId });
      return true;
    } catch {
      return false;
    }
  }

  async function desbloquear(cuentaId: string, pin: string): Promise<ResultadoDesbloqueo> {
    const sesion = await almacen.leerSesion(cuentaId);
    if (!sesion) {
      return { estado: "pin_invalido", intentosFallidos: 0, sesion: null, bloqueoReportado: false };
    }
    if (sesion.bloqueada) {
      return {
        estado: "bloqueada",
        intentosFallidos: sesion.intentosFallidos,
        sesion,
        bloqueoReportado: false,
      };
    }

    const hash = await calcularHash(`${sesion.pinSal ?? ""}:${pin}`);

    if (sesion.pinHash && hash === sesion.pinHash) {
      const actualizada: SesionAlmacenada = { ...sesion, intentosFallidos: 0, instanteMaximoVisto: ahora() };
      await almacen.guardarSesion(actualizada);
      const estado = estadoSesionLocal({
        ahoraDispositivo: ahora(),
        instanteMaximoVisto: actualizada.instanteMaximoVisto,
        ultimaRenovacion: actualizada.ultimaRenovacionServidor ?? 0,
        intentosFallidos: 0,
        bloqueada: false,
      });
      return { estado, intentosFallidos: 0, sesion: actualizada, bloqueoReportado: false };
    }

    const intento = registrarIntento(
      { intentosFallidos: sesion.intentosFallidos, bloqueada: sesion.bloqueada },
      false
    );

    if (!intento.bloqueada) {
      const actualizada: SesionAlmacenada = { ...sesion, intentosFallidos: intento.intentosFallidos };
      await almacen.guardarSesion(actualizada);
      return {
        estado: "pin_invalido",
        intentosFallidos: actualizada.intentosFallidos,
        sesion: actualizada,
        bloqueoReportado: false,
      };
    }

    const tokenRenovacion = sesion.tokenRenovacion;
    const bloqueada: SesionAlmacenada = {
      ...sesion,
      tokenRenovacion: undefined,
      pinSal: undefined,
      pinHash: undefined,
      intentosFallidos: intento.intentosFallidos,
      bloqueada: true,
    };
    await almacen.guardarSesion(bloqueada);
    const bloqueoReportado = tokenRenovacion ? await reportarBloqueo(tokenRenovacion) : false;

    return {
      estado: "bloqueada",
      intentosFallidos: bloqueada.intentosFallidos,
      sesion: bloqueada,
      bloqueoReportado,
    };
  }

  return { activarEquipo, fijarPin, desbloquear };
}
