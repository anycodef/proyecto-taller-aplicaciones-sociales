import { render, screen, waitFor } from "@testing-library/react-native";

import AvisosSistema from "@/app/(equipo)/avisos-sistema";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-coordinacion",
  credencialId: "credencial-1",
  rolesPropios: ["coordinacion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Coordinación",
  esMenor: false,
};

test("RF-112: avisos-sistema muestra la cantidad rechazada y el seudónimo", async () => {
  const cliente = crearClienteFalso({
    "GET /avisos-coordinacion": {
      avisos: [
        {
          id: "aviso-1",
          tipo: "pendientes_rechazados",
          cuentaRelacionadaId: "cuenta-1",
          identidadOperativa: "Luz",
          cantidad: 3,
          creadoEn: "2026-10-19T12:00:00.000Z",
          leidoEn: null,
        },
      ],
    },
  });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <AvisosSistema />
    </ProveedorSesion>
  );

  expect(
    await screen.findByText("Se rechazaron 3 registros del celular de Luz")
  ).toBeTruthy();

  await waitFor(() => expect(cliente.llamadas.some((llamada) => llamada.ruta === "/avisos-coordinacion")).toBe(true));
});
