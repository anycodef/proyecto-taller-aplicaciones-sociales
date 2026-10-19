import { useCallback, useEffect, useState } from "react";

export type EstadoCarga<T> = {
  datos: T | null;
  error: string | null;
  cargando: boolean;
  recargar: () => void;
};

function describirError(error: unknown): string {
  if (error && typeof error === "object" && "codigo" in error) {
    const codigo = String((error as { codigo: unknown }).codigo);
    if (codigo === "fuera_de_alcance") return "Tu rol no puede ver esto.";
    if (codigo === "acceso_denegado") return "Tu sesión ya no sirve. Vuelve a entrar.";
    if (codigo === "credencial_terminada") return "Tu acceso fue revocado.";
  }
  return "No pudimos consultar el servidor. Revisa tu conexión.";
}

/** Carga datos de la API y permite repetir la consulta. */
export function useCarga<T>(cargar: () => Promise<T>, activo = true): EstadoCarga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    void (async () => {
      try {
        const resultado = await cargar();
        if (!vigente) return;
        setDatos(resultado);
        setError(null);
      } catch (fallo) {
        if (!vigente) return;
        setError(describirError(fallo));
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [cargar, vuelta, activo]);

  const recargar = useCallback(() => {
    setCargando(true);
    setVuelta((valor) => valor + 1);
  }, []);

  return { datos, error, cargando, recargar };
}
