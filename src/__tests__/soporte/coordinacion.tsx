import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./cliente-falso";

export const contextoCoordinacion: ContextoAcceso = {
  cuentaId: "cuenta-coordinacion", credencialId: "credencial-1", rolesPropios: ["coordinacion"], gruposAsignados: [],
  catequizandosApoderados: [], identidadOperativa: "Coordinación", esMenor: false,
};

export const loteEnBandeja = {
  loteId: "lote-1", evidenciaId: "ev-1", causa: "salud_nino", canal: "enlace", enviadaEn: "2026-11-09T15:00:00Z",
  justificaciones: [
    { id: "j-1", catequizandoId: "n-1", nombre: "Ana Quispe", sesionId: "misa-8", tipoSesion: "misa", fecha: "2026-11-08", anticipada: false, duplicada: true },
    { id: "j-2", catequizandoId: "n-2", nombre: "Luis Quispe", sesionId: "misa-8", tipoSesion: "misa", fecha: "2026-11-08", anticipada: false, duplicada: false },
  ],
};

export function montarComoCoordinacion(pantalla: ReactElement, respuestas: Record<string, unknown>, contexto = contextoCoordinacion) {
  const cliente = crearClienteFalso(respuestas);
  const resultado = render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      {pantalla}
    </ProveedorSesion>
  );
  return { cliente, ...resultado };
}
