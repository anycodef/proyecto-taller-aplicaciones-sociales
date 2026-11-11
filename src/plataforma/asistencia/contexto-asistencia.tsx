import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useConectividad } from "@/components/catequizandos/use-conectividad";
import {
  resumenPendientes,
  type MarcaPendiente,
  type ResumenPendientes,
} from "@/lib/asistencia/pendientes";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { crearAlmacenLocal, type AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
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
  registrarMarca: (marca: MarcaPendiente) => void;
  sincronizarAhora: () => Promise<void>;
};

const ContextoAsistencia = createContext<EstadoProveedorAsistencia | null>(null);

/**
 * Estado local de la asistencia: la nomina descargada y las marcas que
 * faltan por enviar. Al volver la red se sincroniza solo (RF-307, RF-312).
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
  const [almacen, setAlmacen] = useState<AlmacenLocal>(almacenVacio);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<number | null>(null);
  const disco = useRef<AlmacenLocalDisco>(discoExterno ?? crearAlmacenLocal());
  const antesSinRed = useRef(conConexion);
  const almacenRef = useRef(almacen);
  const sincronizandoRef = useRef(false);

  useEffect(() => {
    const leido = disco.current.leer();
    almacenRef.current = leido;
    setAlmacen(leido);
    setUltimaSincronizacion(leido.ultimoPulso);
    setCargando(false);
  }, []);

  const guardar = useCallback((estado: AlmacenLocal) => {
    almacenRef.current = estado;
    setAlmacen(estado);
    disco.current.guardar(estado);
  }, []);

  const sincronizarAhora = useCallback(async () => {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    setError(null);

    const snapshot = almacenRef.current;
    try {
      const { estado, resultado } = await sincronizar({ almacen: snapshot, cliente });
      // Se aplica sobre el estado mas reciente: una marca registrada durante el
      // push no se pierde.
      const actuales = almacenRef.current;
      const actualesIds = new Set(actuales.pendientes.marcas.map((marca) => marca.id));
      const conserva = snapshot.pendientes.marcas.filter(
        (marca) => !actualesIds.has(marca.id) && !resultado.idsEnviados.includes(marca.id)
      );
      guardar({
        ...estado,
        pendientes: {
          ...estado.pendientes,
          marcas: [...estado.pendientes.marcas, ...conserva],
        },
      });

      if (resultado.nominaActualizada) setUltimaSincronizacion(Date.now());
      if (resultado.rechazados > 0) {
        setError("El servidor rechazó algunas marcas. Se reintentarán al reconectar.");
      }
    } catch {
      setError("No pudimos sincronizar. Los registros siguen en el celular.");
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, [cliente, guardar]);

  // Al volver la conexion se envia lo pendiente antes de nada mas.
  useEffect(() => {
    if (antesSinRed.current || !conConexion) {
      antesSinRed.current = conConexion;
      return;
    }
    antesSinRed.current = conConexion;
    void sincronizarAhora();
  }, [conConexion, sincronizarAhora]);

  const registrarMarca = useCallback(
    (marca: MarcaPendiente) => {
      const actuales = almacenRef.current;
      const pendientes = {
        ...actuales.pendientes,
        marcas: [
          ...actuales.pendientes.marcas.filter((existente) => existente.id !== marca.id),
          { id: marca.id, fila: { ...marca.fila, id: marca.id } },
        ],
      };
      guardar({ ...actuales, pendientes });
    },
    [guardar]
  );

  const valor = useMemo<EstadoProveedorAsistencia>(
    () => ({
      cargando,
      conConexion,
      almacen,
      pendientes: resumenPendientes(almacen.pendientes),
      ultimaSincronizacion,
      sincronizando,
      error,
      registrarMarca,
      sincronizarAhora,
    }),
    [
      cargando,
      conConexion,
      almacen,
      ultimaSincronizacion,
      sincronizando,
      error,
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
