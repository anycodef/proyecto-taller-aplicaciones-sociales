import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/** null mientras no se sabe; las pantallas de justificación solo funcionan con red (RNF-404, RNF-405). */
export function useConexion(): boolean | null {
  const [conectado, setConectado] = useState<boolean | null>(null);
  useEffect(() => {
    let vigente = true;
    void NetInfo.fetch().then((estado) => {
      if (vigente) setConectado(estado.isConnected !== false);
    });
    const cancelar = NetInfo.addEventListener((estado) => setConectado(estado.isConnected !== false));
    return () => {
      vigente = false;
      cancelar();
    };
  }, []);
  return conectado;
}
