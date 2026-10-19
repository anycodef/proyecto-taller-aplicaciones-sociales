import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { rolesEfectivos, type ContextoAcceso, type Rol } from "@/lib/seguridad/contexto-acceso";
import { crearApiSeguridad, type ApiSeguridad, type ClienteHttp } from "@/lib/seguridad/api";

import { obtenerAlmacenSesion, type SesionAlmacenada } from "./almacen-seguro";
import {
  cerrarSesionViva,
  crearClientePorDefecto,
  crearGestorSesionPorDefecto,
  guardarSesionViva,
  type ActivacionPendiente,
  type GestorSesion,
} from "./sesion";

export type TipoSesion = "ninguna" | "equipo" | "familia";

export type EstadoSesionApp = {
  cargando: boolean;
  tipo: TipoSesion;
  contexto: ContextoAcceso | null;
  rolesEfectivos: Rol[];
  jwt: string | null;
  ultimaRenovacion: number | null;
  bloqueada: boolean;
  intentosFallidos: number;
};

export type SesionCargada = {
  tipo: TipoSesion;
  contexto: ContextoAcceso;
  ultimaRenovacion?: number;
  bloqueada?: boolean;
  intentosFallidos?: number;
};

export type ContextoSesionValor = EstadoSesionApp & {
  gestor: GestorSesion;
  cliente: ClienteHttp;
  api: ApiSeguridad;
  activacion: ActivacionPendiente | null;
  guardarActivacion(activacion: ActivacionPendiente | null): void;
  iniciarSesion(tipo: TipoSesion, contexto: ContextoAcceso, jwt?: string | null): void;
  cerrarSesion(): void;
};

export const ContextoSesion = createContext<ContextoSesionValor | null>(null);

const ESTADO_VACIO: EstadoSesionApp = {
  cargando: false,
  tipo: "ninguna",
  contexto: null,
  rolesEfectivos: [],
  jwt: null,
  ultimaRenovacion: null,
  bloqueada: false,
  intentosFallidos: 0,
};

/**
 * Reconstruye el contexto de acceso desde lo guardado en el celular.
 * La identidad operativa no se guarda: el app la recibe en linea (plan 3.3).
 */
export function contextoDeSesion(sesion: SesionAlmacenada): ContextoAcceso {
  return {
    cuentaId: sesion.cuentaId,
    credencialId: sesion.credencialId,
    rolesPropios: sesion.contexto.rolesPropios,
    ...(sesion.contexto.delegacionVigente ? { delegacionVigente: sesion.contexto.delegacionVigente } : {}),
    gruposAsignados: sesion.contexto.gruposAsignados,
    catequizandosApoderados: sesion.contexto.catequizandosApoderados,
    identidadOperativa: "",
    esMenor: sesion.contexto.esMenor,
  };
}

export async function cargarSesionGuardada(): Promise<SesionCargada | null> {
  const almacen = obtenerAlmacenSesion();
  for (const cuentaId of await almacen.listarCuentas()) {
    const sesion = await almacen.leerSesion(cuentaId);
    if (!sesion) continue;
    return {
      tipo: sesion.tipo,
      contexto: contextoDeSesion(sesion),
      ultimaRenovacion: sesion.ultimaRenovacionServidor,
      bloqueada: sesion.bloqueada,
      intentosFallidos: sesion.intentosFallidos,
    };
  }
  return null;
}

export function ProveedorSesion({
  children,
  cargar = cargarSesionGuardada,
  gestor: gestorExterno,
  cliente: clienteExterno,
}: {
  children: ReactNode;
  cargar?: () => Promise<SesionCargada | null>;
  gestor?: GestorSesion;
  cliente?: ClienteHttp;
}) {
  const [estado, setEstado] = useState<EstadoSesionApp>({ ...ESTADO_VACIO, cargando: true });
  const [activacion, setActivacion] = useState<ActivacionPendiente | null>(null);

  /** Estado vivo de la sesion: JWT y cuenta, ambos solo en memoria. */
  const [gestor] = useState<GestorSesion>(() => gestorExterno ?? crearGestorSesionPorDefecto());
  const [cliente] = useState<ClienteHttp>(() => clienteExterno ?? crearClientePorDefecto());
  const [api] = useState<ApiSeguridad>(() => crearApiSeguridad(cliente));

  useEffect(() => {
    let vigente = true;
    void (async () => {
      let cargada: SesionCargada | null = null;
      try {
        cargada = await cargar();
      } catch {
        cargada = null;
      }
      if (!vigente) return;
      setEstado(
        cargada
          ? {
              cargando: false,
              tipo: cargada.tipo,
              contexto: cargada.contexto,
              rolesEfectivos: rolesEfectivos(cargada.contexto),
              jwt: null,
              ultimaRenovacion: cargada.ultimaRenovacion ?? null,
              bloqueada: cargada.bloqueada ?? false,
              intentosFallidos: cargada.intentosFallidos ?? 0,
            }
          : ESTADO_VACIO
      );
    })();
    return () => {
      vigente = false;
    };
  }, [cargar]);

  const valor = useMemo<ContextoSesionValor>(
    () => ({
      ...estado,
      gestor,
      cliente,
      api,
      activacion,
      guardarActivacion: setActivacion,
      iniciarSesion: (tipo, contexto, jwt = null) => {
        guardarSesionViva(contexto, jwt);
        setEstado({
          cargando: false,
          tipo,
          contexto,
          rolesEfectivos: rolesEfectivos(contexto),
          jwt,
          ultimaRenovacion: null,
          bloqueada: false,
          intentosFallidos: 0,
        });
      },
      cerrarSesion: () => {
        cerrarSesionViva();
        setEstado(ESTADO_VACIO);
      },
    }),
    [estado, gestor, cliente, api, activacion]
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ContextoSesionValor {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error("useSesion necesita el ProveedorSesion");
  return valor;
}
