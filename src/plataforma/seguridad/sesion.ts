import * as Crypto from "expo-crypto";
import { router } from "expo-router";

import { crearClienteHttp, type ClienteHttp } from "@/plataforma/api/cliente";
import { claveSuscripcionApi, ES_DESARROLLO, urlBaseApi } from "@/plataforma/config";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { registrarIntento, verificadorPin } from "@/lib/seguridad/pin";
import { estadoSesionLocal, type EstadoSesion } from "@/lib/seguridad/sesion-local";

import { contextoAlmacenable, obtenerAlmacenSesion, type AlmacenSesion, type SesionAlmacenada } from "./almacen-seguro";

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

export type EntradaFamilia = {
  jwt: string;
  contexto: ContextoAcceso;
};

export type GestorSesion = {
  activarEquipo(tokenEnlace: string): Promise<ActivacionPendiente>;
  fijarPin(activacion: ActivacionPendiente, pin: string): Promise<SesionAlmacenada>;
  desbloquear(cuentaId: string, pin: string): Promise<ResultadoDesbloqueo>;
  entrarFamilia(tokenEnlace: string): Promise<EntradaFamilia>;
  renovarSesion(cuentaId: string): Promise<string | null>;
};

/**
 * El enlace de familia se queda solo en memoria: permite volver a entrar
 * cuando vence el JWT sin guardar el token en el dispositivo (RF-110).
 */
let tokenFamiliaEnMemoria: string | null = null;

export function guardarTokenFamilia(token: string): void {
  tokenFamiliaEnMemoria = token;
}

export function leerTokenFamilia(): string | null {
  return tokenFamiliaEnMemoria;
}

/**
 * Token de un enlace pegado a mano. Vive solo en memoria para no ponerlo en
 * la URL, donde si queda en el historial y en los registros (D-102).
 */
let tokenPendienteEnMemoria: string | null = null;

export function guardarTokenPendiente(token: string | null): void {
  tokenPendienteEnMemoria = token;
}

export function leerTokenPendiente(): string | null {
  return tokenPendienteEnMemoria;
}

/** Sesion viva: JWT y cuenta activa, solo en memoria. */
let jwtVivo: string | null = null;
let cuentaViva: string | null = null;
let gestorVivo: GestorSesion | null = null;

export function guardarSesionViva(contexto: ContextoAcceso, jwt: string | null): void {
  jwtVivo = jwt;
  cuentaViva = contexto.cuentaId;
}

export function cerrarSesionViva(): void {
  jwtVivo = null;
  cuentaViva = null;
}

export function leerJwtVivo(): string | null {
  return jwtVivo;
}

/**
 * Gestor con el cliente real. Sin URL de API configurada avisa en vez de
 * romper la app al arrancar.
 */
export function crearGestorSesionPorDefecto(): GestorSesion {
  const url = urlBaseApi();
  const cliente: ClienteHttp = url
    ? crearClienteHttp({
        urlBase: url,
        claveSuscripcion: claveSuscripcionApi(),
        obtenerToken: async () => jwtVivo,
        renovarSesion: async () =>
          cuentaViva ? (await gestorVivo?.renovarSesion(cuentaViva)) ?? null : null,
        irASinAcceso: (rechazados) => {
          router.replace({ pathname: "/acceso/sin-acceso", params: { rechazados: String(rechazados) } });
        },
        enDesarrollo: ES_DESARROLLO,
      })
    : {
        solicitar: async () => {
          throw new Error("api_sin_configurar");
        },
      };

  const gestor = crearGestorSesion({ almacen: obtenerAlmacenSesion(), cliente });
  gestorVivo = gestor;
  return gestor;
}

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

  async function entrarFamilia(tokenEnlace: string): Promise<EntradaFamilia> {
    const respuesta = await cliente.solicitar<{ jwt: string; contexto: ContextoAcceso }>(
      "POST",
      "/acceso/familia/entrar",
      { token: tokenEnlace }
    );
    guardarTokenFamilia(tokenEnlace);
    return { jwt: respuesta.jwt, contexto: respuesta.contexto };
  }

  /** Renueva la credencial del equipo y guarda el nuevo token de renovacion. */
  async function renovarSesion(cuentaId: string): Promise<string | null> {
    const sesion = await almacen.leerSesion(cuentaId);
    if (!sesion?.tokenRenovacion) return null;

    const dispositivoId = await almacen.obtenerDispositivoId();
    const respuesta = await cliente.solicitar<RespuestaActivacionServidor>("POST", "/acceso/renovar", {
      tokenRenovacion: sesion.tokenRenovacion,
      dispositivoId,
    });

    await almacen.guardarSesion({
      ...sesion,
      tokenRenovacion: respuesta.tokenRenovacion ?? sesion.tokenRenovacion,
      ultimaRenovacionServidor: respuesta.ultimaRenovacion
        ? Date.parse(respuesta.ultimaRenovacion)
        : sesion.ultimaRenovacionServidor,
      instanteMaximoVisto: ahora(),
    });

    return respuesta.jwt;
  }

  return { activarEquipo, fijarPin, desbloquear, entrarFamilia, renovarSesion };
}
