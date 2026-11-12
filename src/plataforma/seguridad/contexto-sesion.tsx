import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { rolesEfectivos, type ContextoAcceso, type Rol } from "@/lib/seguridad/contexto-acceso";
import { crearApiSeguridad, type ApiSeguridad, type ClienteHttp } from "@/lib/seguridad/api";
import { crearApiCatequizandos, type ApiCatequizandos } from "@/lib/catequizandos/api";

import { obtenerAlmacenSesion, type SesionAlmacenada } from "./almacen-seguro";
import {
  cerrarSesionViva,
  crearClientePorDefecto,
  crearGestorSesionPorDefecto,
  guardarSesionViva,
  type ActivacionPendiente,
  type GestorSesion,
  type ResultadoDesbloqueo,
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
  desbloqueada: boolean;
  modoConsulta: boolean;
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
  apiCatequizandos: ApiCatequizandos;
  activacion: ActivacionPendiente | null;
  guardarActivacion(activacion: ActivacionPendiente | null): void;
  iniciarSesion(tipo: TipoSesion, contexto: ContextoAcceso, jwt?: string | null): void;
  desbloquearSesion(pin: string): Promise<ResultadoDesbloqueo>;
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
  desbloqueada: false,
  modoConsulta: false,
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
    // El servidor exige el dispositivo en cada registro: sin el, no se puede
    // pasar lista ni registrar una asistencia.
    ...(sesion.dispositivoId ? { dispositivoId: sesion.dispositivoId } : {}),
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
    if (!sesion || sesion.tipo !== "equipo") continue;
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
  const revision = useRef(0);

  /** Estado vivo de la sesion: JWT y cuenta, ambos solo en memoria. */
  const [gestor] = useState<GestorSesion>(() => gestorExterno ?? crearGestorSesionPorDefecto());
  const [cliente] = useState<ClienteHttp>(() => clienteExterno ?? crearClientePorDefecto());
  const [api] = useState<ApiSeguridad>(() => crearApiSeguridad(cliente));
  const [apiCatequizandos] = useState<ApiCatequizandos>(() => crearApiCatequizandos(cliente));

  useEffect(() => {
    let vigente = true;
    const revisionInicial = revision.current;
    void (async () => {
      let cargada: SesionCargada | null = null;
      try {
        cargada = await cargar();
      } catch {
        cargada = null;
      }
      if (!vigente || revision.current !== revisionInicial) return;
      setEstado(
        cargada?.tipo === "equipo"
          ? {
              cargando: false,
              tipo: cargada.tipo,
              contexto: cargada.contexto,
              rolesEfectivos: rolesEfectivos(cargada.contexto),
              jwt: null,
              ultimaRenovacion: cargada.ultimaRenovacion ?? null,
              bloqueada: cargada.bloqueada ?? false,
              desbloqueada: false,
              modoConsulta: false,
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
      apiCatequizandos,
      activacion,
      guardarActivacion: setActivacion,
      iniciarSesion: (tipo, contexto, jwt = null) => {
        revision.current += 1;
        guardarSesionViva(contexto, jwt);
        setEstado({
          cargando: false,
          tipo,
          contexto,
          rolesEfectivos: rolesEfectivos(contexto),
          jwt,
          ultimaRenovacion: null,
          bloqueada: false,
          desbloqueada: true,
          modoConsulta: false,
          intentosFallidos: 0,
        });
      },
      desbloquearSesion: async (pin) => {
        const cuentaId = estado.contexto?.cuentaId;
        if (estado.tipo !== "equipo" || !cuentaId) {
          throw new Error("sesion_equipo_requerida");
        }
        const revisionInicial = revision.current;
        const resultado = await gestor.desbloquear(cuentaId, pin);
        if (revision.current !== revisionInicial) return resultado;
        const sesion = resultado.sesion;
        const desbloqueada = Boolean(
          sesion && sesion.tipo === "equipo" && sesion.cuentaId === cuentaId &&
          !sesion.bloqueada && resultado.intentosFallidos === 0 &&
          (resultado.estado === "operativa" || resultado.estado === "requiere-conexion")
        );
        const contexto = desbloqueada && sesion ? contextoDeSesion(sesion) : estado.contexto;
        if (desbloqueada && contexto) guardarSesionViva(contexto, null);
        else cerrarSesionViva();
        setEstado({
          ...estado,
          contexto,
          rolesEfectivos: contexto ? rolesEfectivos(contexto) : [],
          jwt: null,
          ultimaRenovacion: sesion?.ultimaRenovacionServidor ?? estado.ultimaRenovacion,
          bloqueada: resultado.estado === "bloqueada",
          desbloqueada,
          modoConsulta: desbloqueada && resultado.estado === "requiere-conexion",
          intentosFallidos: resultado.intentosFallidos,
        });
        return resultado;
      },
      cerrarSesion: () => {
        revision.current += 1;
        cerrarSesionViva();
        setEstado(ESTADO_VACIO);
      },
    }),
    [estado, gestor, cliente, api, apiCatequizandos, activacion]
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ContextoSesionValor {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error("useSesion necesita el ProveedorSesion");
  return valor;
}
