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
import { fusionarTrasSincronizar, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
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
  const { cliente, contexto } = useSesion();
  const cuentaId = contexto?.cuentaId ?? null;
  const cuentaRef = useRef(cuentaId);
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
    const cuentaAlEmpezar = cuentaRef.current;
    try {
      const { estado, resultado } = await sincronizar({ almacen: snapshot, cliente });
      // Si la sesion se cerro mientras tanto, la nomina descargada no se guarda.
      if (cuentaRef.current !== cuentaAlEmpezar) return;
      // Se aplica sobre el estado mas reciente: lo registrado durante el push
      // (marcas, listas, correcciones) no se pierde.
      repositorio.escribir(fusionarTrasSincronizar(snapshot, estado, repositorio.estado()));

      if (resultado.rechazados > 0) {
        setError("El servidor no aceptó algunos registros. Revisa el motivo en «Por enviar».");
      }
    } catch {
      setError("No pudimos sincronizar. Los registros siguen en el celular.");
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, [cliente, repositorio]);

  // Al cerrar sesion la nomina sale del celular; quedan solo los pendientes de
  // la cuenta que salio (planCierreSesion, RNF-306).
  useEffect(() => {
    const anterior = cuentaRef.current;
    cuentaRef.current = cuentaId;
    if (anterior && anterior !== cuentaId) repositorio.purgarExceptoPendientes(anterior);
  }, [cuentaId, repositorio]);

  // Al abrir la app se baja la nomina una vez, para no esperar al primer
  // toque del usuario.
  const sincronizadoAlAbrir = useRef(false);
  useEffect(() => {
    if (!conConexion || sincronizadoAlAbrir.current) return;
    sincronizadoAlAbrir.current = true;
    void sincronizarAhora();
  }, [conConexion, sincronizarAhora]);

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
    const hayPendientes = resumenPendientes(pendientesActuales).total > 0;
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
