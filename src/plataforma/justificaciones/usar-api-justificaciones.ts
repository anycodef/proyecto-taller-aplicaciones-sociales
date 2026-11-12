import { useMemo } from "react";

import { crearClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";

/** Referencia estable mientras la sesión no cambie de cliente, para no repetir cargas de `useCarga`. */
export function useApiJustificaciones() {
  const { cliente } = useSesion();
  return useMemo(() => crearClienteJustificaciones(cliente), [cliente]);
}
