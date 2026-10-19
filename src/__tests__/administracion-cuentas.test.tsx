import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import FichaCuenta from "@/app/(equipo)/cuentas/[id]";
import NuevaCuenta from "@/app/(equipo)/cuentas/nueva";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-coordinacion",
  credencialId: "credencial-1",
  rolesPropios: ["coordinacion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Coordinación",
  esMenor: false,
};

afterEach(() => {
  jest.restoreAllMocks();
});

test("RNF-105: COORD crea una cuenta, asigna el rol y genera el enlace desde la app", async () => {
  const compartir = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  const cliente = crearClienteFalso({
    "POST /cuentas": { id: "cuenta-nueva" },
    "GET /cuentas/cuenta-nueva": {
      id: "cuenta-nueva",
      identidadOperativa: "Luz",
      esMenor: true,
      activa: true,
      roles: ["catequista"],
    },
    "POST /cuentas/cuenta-nueva/enlaces": { url: "https://sigecat.app/acceso/equipo#t=token" },
  });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <NuevaCuenta />
    </ProveedorSesion>
  );

  fireEvent.changeText(screen.getByLabelText("Seudónimo"), "Luz");
  fireEvent.press(screen.getByText("Sí"));
  fireEvent.press(screen.getByText("Catequista"));
  fireEvent.changeText(screen.getByLabelText("Nombres reales"), "Ana");
  fireEvent.changeText(screen.getByLabelText("Apellidos reales"), "Pérez");
  fireEvent.press(screen.getByText("Crear la cuenta"));

  await waitFor(() => {
    const alta = cliente.llamadas.find((llamada) => llamada.ruta === "/cuentas");
    expect(alta?.cuerpo).toMatchObject({
      identidadOperativa: "Luz",
      esMenor: true,
      roles: ["catequista"],
      identidadReal: { nombres: "Ana", apellidos: "Pérez" },
    });
  });
  expect(String((cliente.llamadas.find((llamada) => llamada.ruta === "/cuentas")?.cuerpo as { id: string }).id)).toMatch(
    /^[0-9a-f-]{36}$/
  );

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <FichaCuenta id="cuenta-nueva" />
    </ProveedorSesion>
  );
  fireEvent.press(await screen.findByText("Generar enlace del equipo"));

  await waitFor(() =>
    expect(compartir).toHaveBeenCalledWith({
      message: "https://sigecat.app/acceso/equipo#t=token",
      title: "Tu enlace de SIGECAT",
    })
  );
});
