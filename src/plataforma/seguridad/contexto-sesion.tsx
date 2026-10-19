import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { rolesEfectivos, type ContextoAcceso, type Rol } from "@/lib/seguridad/contexto-acceso";

import { obtenerAlmacenSesion, type SesionAlmacenada } from "./almacen-seguro";

export type TipoSesion = "ninguna" | "equipo" | "familia";

export type EstadoSesionApp = {
  cargando: boolean;
  tipo: TipoSesion;
  contexto: ContextoAcceso | null;
  rolesEfectivos: Rol[];
};

export type SesionCargada = { tipo: TipoSesion; contexto: ContextoAcceso };

export type ContextoSesionValor = EstadoSesionApp & {
  iniciarSesion(tipo: TipoSesion, contexto: ContextoAcceso): void;
  cerrarSesion(): void;
};

export const ContextoSesion = createContext<ContextoSesionValor | null>(null);

const ESTADO_VACIO: EstadoSesionApp = {
  cargando: false,
  tipo: "ninguna",
  contexto: null,
  rolesEfectivos: [],
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
    if (sesion && !sesion.bloqueada) return { tipo: sesion.tipo, contexto: contextoDeSesion(sesion) };
  }
  return null;
}

export function ProveedorSesion({
  children,
  cargar = cargarSesionGuardada,
}: {
  children: ReactNode;
  cargar?: () => Promise<SesionCargada | null>;
}) {
  const [estado, setEstado] = useState<EstadoSesionApp>({ ...ESTADO_VACIO, cargando: true });

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
      iniciarSesion: (tipo, contexto) =>
        setEstado({ cargando: false, tipo, contexto, rolesEfectivos: rolesEfectivos(contexto) }),
      cerrarSesion: () => setEstado(ESTADO_VACIO),
    }),
    [estado]
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ContextoSesionValor {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error("useSesion necesita el ProveedorSesion");
  return valor;
}
