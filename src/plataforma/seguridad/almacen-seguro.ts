import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";

export const CLAVE_DISPOSITIVO = "sigecat.dispositivo";
export const CLAVE_CUENTAS = "sigecat.cuentas";

/** SecureStore rechaza en algunas versiones de iOS los valores de mas de 2048 bytes. */
export const LIMITE_BYTES_SESION = 2048;

export function claveSesion(cuentaId: string): string {
  return `sigecat.sesion.${cuentaId}`;
}

export type AlmacenSeguro = {
  leer(clave: string): Promise<string | null>;
  escribir(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
};

export function crearAlmacenSecureStore(): AlmacenSeguro {
  return {
    leer: (clave) => SecureStore.getItemAsync(clave),
    escribir: (clave, valor) => SecureStore.setItemAsync(clave, valor),
    borrar: (clave) => SecureStore.deleteItemAsync(clave),
  };
}

/**
 * Contexto que queda en el celular: roles e identificadores de grupos y ninos.
 * No guarda nombres ni la identidad operativa (RF-112, RF-107).
 */
export type ContextoSesionAlmacenada = {
  rolesPropios: Rol[];
  gruposAsignados: string[];
  catequizandosApoderados: string[];
  delegacionVigente?: { id: string; hasta: string };
  esMenor: boolean;
};

export type SesionAlmacenada = {
  tipo: "equipo" | "familia";
  cuentaId: string;
  credencialId: string;
  tokenRenovacion?: string;
  ultimaRenovacionServidor?: number;
  instanteMaximoVisto: number;
  pinSal?: string;
  pinHash?: string;
  intentosFallidos: number;
  bloqueada: boolean;
  contexto: ContextoSesionAlmacenada;
};

export function contextoAlmacenable(contexto: ContextoAcceso): ContextoSesionAlmacenada {
  return {
    rolesPropios: contexto.rolesPropios,
    gruposAsignados: contexto.gruposAsignados,
    catequizandosApoderados: contexto.catequizandosApoderados,
    ...(contexto.delegacionVigente ? { delegacionVigente: contexto.delegacionVigente } : {}),
    esMenor: contexto.esMenor,
  };
}

export type AlmacenSesion = {
  obtenerDispositivoId(): Promise<string>;
  listarCuentas(): Promise<string[]>;
  registrarCuenta(cuentaId: string): Promise<void>;
  guardarSesion(sesion: SesionAlmacenada): Promise<void>;
  leerSesion(cuentaId: string): Promise<SesionAlmacenada | null>;
  borrarSesion(cuentaId: string): Promise<void>;
};

function byteLength(texto: string): number {
  let total = 0;
  for (const caracter of texto) {
    const punto = caracter.codePointAt(0) ?? 0;
    total += punto <= 0x7f ? 1 : punto <= 0x7ff ? 2 : punto <= 0xffff ? 3 : 4;
  }
  return total;
}

export function crearAlmacenSesion(opciones: {
  almacen: AlmacenSeguro;
  generarUuid?: () => string;
}): AlmacenSesion {
  const { almacen } = opciones;
  const generarUuid = opciones.generarUuid ?? (() => Crypto.randomUUID());
  let dispositivoEnCurso: Promise<string> | null = null;

  async function obtenerDispositivoId(): Promise<string> {
    const guardado = await almacen.leer(CLAVE_DISPOSITIVO);
    if (guardado) return guardado;
    if (!dispositivoEnCurso) {
      dispositivoEnCurso = (async () => {
        try {
          const nuevo = generarUuid();
          await almacen.escribir(CLAVE_DISPOSITIVO, nuevo);
          return nuevo;
        } finally {
          dispositivoEnCurso = null;
        }
      })();
    }
    return dispositivoEnCurso;
  }

  async function listarCuentas(): Promise<string[]> {
    const bruto = await almacen.leer(CLAVE_CUENTAS);
    if (!bruto) return [];
    try {
      const lista: unknown = JSON.parse(bruto);
      if (!Array.isArray(lista)) return [];
      return lista.filter((cuenta): cuenta is string => typeof cuenta === "string");
    } catch {
      return [];
    }
  }

  async function registrarCuenta(cuentaId: string): Promise<void> {
    const cuentas = await listarCuentas();
    if (cuentas.includes(cuentaId)) return;
    await almacen.escribir(CLAVE_CUENTAS, JSON.stringify([...cuentas, cuentaId]));
  }

  async function guardarSesion(sesion: SesionAlmacenada): Promise<void> {
    const bruto = JSON.stringify(sesion);
    if (byteLength(bruto) > LIMITE_BYTES_SESION) throw new Error("sesion_demasiado_grande");
    await almacen.escribir(claveSesion(sesion.cuentaId), bruto);
    await registrarCuenta(sesion.cuentaId);
  }

  async function leerSesion(cuentaId: string): Promise<SesionAlmacenada | null> {
    const bruto = await almacen.leer(claveSesion(cuentaId));
    if (!bruto) return null;
    try {
      return JSON.parse(bruto) as SesionAlmacenada;
    } catch {
      return null;
    }
  }

  async function borrarSesion(cuentaId: string): Promise<void> {
    await almacen.borrar(claveSesion(cuentaId));
  }

  return {
    obtenerDispositivoId,
    listarCuentas,
    registrarCuenta,
    guardarSesion,
    leerSesion,
    borrarSesion,
  };
}

let almacenSesionUnico: AlmacenSesion | null = null;

/** Almacen seguro del proceso, sobre SecureStore. */
export function obtenerAlmacenSesion(): AlmacenSesion {
  if (!almacenSesionUnico) {
    almacenSesionUnico = crearAlmacenSesion({ almacen: crearAlmacenSecureStore() });
  }
  return almacenSesionUnico;
}
