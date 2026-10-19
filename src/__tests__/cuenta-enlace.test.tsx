import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Share } from "react-native";

import FichaCuenta from "@/app/(equipo)/cuentas/[id]";
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

const cuenta = {
  id: "cuenta-1",
  identidadOperativa: "Luz",
  esMenor: true,
  activa: true,
  roles: ["catequista"],
};

afterEach(() => {
  jest.restoreAllMocks();
});

test("RF-110: compartir usa la hoja de compartir del sistema, sin servicio de mensajería", async () => {
  const compartir = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  const cliente = crearClienteFalso({
    "GET /cuentas/cuenta-1": cuenta,
    "POST /cuentas/cuenta-1/enlaces": { url: "https://sigecat.app/acceso/equipo#t=token" },
  });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <FichaCuenta id="cuenta-1" />
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

test("RF-111: revocar desde la ficha pide confirmación y llama al endpoint", async () => {
  const cliente = crearClienteFalso({
    "GET /cuentas/cuenta-1": cuenta,
    "POST /cuentas/cuenta-1/enlaces/revocar": {},
  });

  const alert = jest.spyOn(Alert, "alert").mockImplementation((_titulo, _mensaje, botones) => {
    const revocar = botones?.find((boton) => boton.text === "Revocar");
    revocar?.onPress?.();
  });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <FichaCuenta id="cuenta-1" />
    </ProveedorSesion>
  );

  fireEvent.press(await screen.findByText("Revocar el enlace"));

  await waitFor(() => expect(alert).toHaveBeenCalled());
  expect(String(alert.mock.calls[0]?.[1] ?? "")).toContain("dejará de funcionar");
  await waitFor(() =>
    expect(cliente.llamadas.some((llamada) => llamada.ruta === "/cuentas/cuenta-1/enlaces/revocar")).toBe(true)
  );
});
