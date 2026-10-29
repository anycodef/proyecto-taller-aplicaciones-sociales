import { useState, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Hook que detecta la conectividad de red.
 * Se usa en pantallas que exigen conexión (inscripción, edición, grupos, etc.).
 * Mientras T003-74 (orquestador de sincronización) no esté implementado, este
 * hook es el punto de control simple: si no hay red, no se envía al servidor.
 */
export function useConectividad(): { conConexion: boolean } {
  const [conConexion, setConConexion] = useState<boolean>(true);

  useEffect(() => {
    const suscripcion = NetInfo.addEventListener((estado) => {
      setConConexion(estado.isConnected === true);
    });

    // Obtener estado inicial
    NetInfo.fetch().then((estado) => {
      setConConexion(estado.isConnected === true);
    });

    return () => suscripcion();
  }, []);

  return { conConexion };
}
