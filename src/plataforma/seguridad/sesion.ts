import * as Crypto from "expo-crypto";

import type { ClienteHttp } from "@/plataforma/api/cliente";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { verificadorPin } from "@/lib/seguridad/pin";

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

export type GestorSesion = {
  activarEquipo(tokenEnlace: string): Promise<ActivacionPendiente>;
  fijarPin(activacion: ActivacionPendiente, pin: string): Promise<SesionAlmacenada>;
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

  return { activarEquipo, fijarPin };
}
