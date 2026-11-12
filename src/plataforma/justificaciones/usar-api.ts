import { useMemo } from "react";

import { crearClienteJustificaciones, type ClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import { useSesion } from "@/plataforma/seguridad/contexto-sesion";

export function useApiJustificaciones(): ClienteJustificaciones {
  const { cliente } = useSesion();
  return useMemo(() => crearClienteJustificaciones(cliente), [cliente]);
}
