import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import NuevaDelegacion from "@/app/(equipo)/delegaciones/nueva";
import ListaDelegaciones from "@/app/(equipo)/delegaciones/index";
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

jest.mock("expo-crypto", () => ({
  randomUUID: () => "22222222-2222-4222-8222-222222222222",
}));

const cuentas = {
  cuentas: [
    { id: "cuenta-1", identidadOperativa: "Luz", esMenor: true, activa: true, roles: ["catequista"] },
    { id: "cuenta-2", identidadOperativa: "Los Andes", esMenor: false, activa: true, roles: ["familia"] },
  ],
};

test("RNF-105: COORD delega desde la app", async () => {
  const cliente = crearClienteFalso({
    "GET /cuentas": cuentas,
    "POST /delegaciones": { id: "delegacion-1" },
  });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <NuevaDelegacion />
    </ProveedorSesion>
  );

  fireEvent.press(await screen.findByText("Luz"));
  fireEvent.press(screen.getByText("Registrar la delegación"));

  await waitFor(() => {
    const llamada = cliente.llamadas.find((registro) => registro.ruta === "/delegaciones");
    expect(llamada?.cuerpo).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      delegadoId: "cuenta-1",
      desde: expect.stringContaining("T00:00:00-05:00"),
      hasta: expect.stringContaining("T23:59:59-05:00"),
    });
  });
});

test("RF-104: la lista muestra delegante, delegado, periodo y revocación", async () => {
  const cliente = crearClienteFalso({
    "GET /delegaciones": {
      delegaciones: [
        {
          id: "delegacion-1",
          deleganteId: "cuenta-coordinacion",
          delegadoId: "cuenta-1",
          deleganteVisible: "Coordinación",
          delegadoVisible: "Luz",
          desde: "2026-10-01T00:00:00-05:00",
          hasta: "2026-10-31T23:59:59-05:00",
          revocadaEn: null,
        },
        {
          id: "delegacion-2",
          deleganteId: "cuenta-coordinacion",
          delegadoId: "cuenta-3",
          deleganteVisible: "Coordinación",
          delegadoVisible: "Marcos",
          desde: "2026-09-01T00:00:00-05:00",
          hasta: "2026-09-30T23:59:59-05:00",
          revocadaEn: "2026-10-02T10:00:00.000Z",
        },
      ],
    },
  });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <ListaDelegaciones />
    </ProveedorSesion>
  );

  expect(await screen.findByText("Coordinación delega en Luz")).toBeTruthy();
  expect(screen.getByText("Del 2026-10-01 al 2026-10-31")).toBeTruthy();
  expect(screen.getByText("Coordinación delega en Marcos")).toBeTruthy();
  expect(screen.getByText("Del 2026-09-01 al 2026-09-30")).toBeTruthy();
  expect(screen.getByText("Vigente")).toBeTruthy();
  expect(screen.getByText("Revocada")).toBeTruthy();
});
