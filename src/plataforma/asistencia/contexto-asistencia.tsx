import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { useConectividad } from "@/components/catequizandos/use-conectividad";
import {
  resumenPendientes,
  type MarcaPendiente,
  type ResumenPendientes,
} from "@/lib/asistencia/pendientes";
import type { RepositorioAsistencia } from "@/lib/asistencia/repositorio-asistencia";
import type { AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { crearAlmacenLocal, type AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { crearRepositorioLocal } from "@/plataforma/asistencia/repositorio-local";
import { sincronizar } from "@/plataforma/asistencia/sincronizador";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";

export type EstadoProveedorAsistencia = {
  cargando: boolean;
  conConexion: boolean;
  almacen: AlmacenLocal;
  pendientes: ResumenPendientes;
  ultimaSincronizacion: number | null;
  sincronizando: boolean;
  error: string | null;
  /** Repositorio de la asistencia en el dispositivo. */
  repositorio: RepositorioAsistencia;
  registrarMarca: (marca: MarcaPendiente) => void;
  sincronizarAhora: () => Promise<void>;
};

const ContextoAsistencia = createContext<EstadoProveedorAsistencia | null>(null);

/**
 * Estado local de la asistencia: la nomina descargada y las marcas que
 * faltan por enviar. Al volver la red se sincroniza solo (RF-307, RF-312).
 *
 * El almacen local es un almacen externo: el proveedor se suscribe a el y
 * redibuja cuando cambia. Asi el dominio no depende de como se guardan las
 * filas y la base local puede cambiar sin tocar las reglas.
 */
export function ProveedorAsistencia({
  children,
  disco: discoExterno,
}: {
  children: ReactNode;
  disco?: AlmacenLocalDisco;
}) {
  const { cliente } = useSesion();
  const { conConexion } = useConectividad();
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const antesSinRed = useRef(conConexion);
  const sincronizandoRef = useRef(false);

  const disco = useMemo<AlmacenLocalDisco>(
    () => discoExterno ?? crearAlmacenLocal(),
    [discoExterno]
  );
  const repositorio = useMemo(() => crearRepositorioLocal(disco), [disco]);
  const almacen = useSyncExternalStore(
    repositorio.suscribir,
    repositorio.estado,
    repositorio.estado
  );

  const sincronizarAhora = useCallback(async () => {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    setError(null);

    const snapshot = repositorio.estado();
    try {
      const { estado, resultado } = await sincronizar({ almacen: snapshot, cliente });
      // Se aplica sobre el estado mas reciente: una marca registrada durante el
      // push no se pierde.
      const actuales = repositorio.estado();
      const actualesIds = new Set(actuales.pendientes.marcas.map((marca) => marca.id));
      const conserva = snapshot.pendientes.marcas.filter(
        (marca) => !actualesIds.has(marca.id) && !resultado.idsEnviados.includes(marca.id)
      );
      repositorio.escribir({
        ...estado,
        pendientes: {
          ...estado.pendientes,
          marcas: [...estado.pendientes.marcas, ...conserva],
        },
      });

      if (resultado.rechazados > 0) {
        setError("El servidor rechazó algunas marcas. Se reintentarán al reconectar.");
      }
    } catch {
      setError("No pudimos sincronizar. Los registros siguen en el celular.");
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, [cliente, repositorio]);

  // Al volver la conexion se envia lo pendiente antes de nada mas.
  useEffect(() => {
    if (antesSinRed.current || !conConexion) {
      antesSinRed.current = conConexion;
      return;
    }
    antesSinRed.current = conConexion;
    void sincronizarAhora();
  }, [conConexion, sincronizarAhora]);

  // Al volver a primer plano se envia lo que quedo pendiente: el cellular
  // pudo haber pasado la lista sin conexion mientras la app estaba en segundo
  // plano (T003-74).
  const pendientesActuales = almacen.pendientes;
  useEffect(() => {
    const hayPendientes =
      pendientesActuales.marcas.length + pendientesActuales.listas.length + pendientesActuales.correcciones.length > 0;
    if (!hayPendientes) return;
    const suscripcion = AppState.addEventListener("change", estado => {
      if (estado === "active") void sincronizarAhora();
    });
    return () => suscripcion.remove();
  }, [pendientesActuales, sincronizarAhora]);

  const registrarMarca = useCallback(
    (marca: MarcaPendiente) => {
      repositorio.registrarMarca({ ...marca.fila, id: marca.id });
    },
    [repositorio]
  );

  const valor = useMemo<EstadoProveedorAsistencia>(
    () => ({
      cargando: false,
      conConexion,
      almacen,
      pendientes: resumenPendientes(almacen.pendientes),
      ultimaSincronizacion: almacen.ultimoPulso,
      sincronizando,
      error,
      repositorio,
      registrarMarca,
      sincronizarAhora,
    }),
    [
      conConexion,
      almacen,
      sincronizando,
      error,
      repositorio,
      registrarMarca,
      sincronizarAhora,
    ]
  );

  return <ContextoAsistencia.Provider value={valor}>{children}</ContextoAsistencia.Provider>;
}

export function useAsistencia(): EstadoProveedorAsistencia {
  const valor = useContext(ContextoAsistencia);
  if (!valor) throw new Error("useAsistencia necesita el ProveedorAsistencia");
  return valor;
}
