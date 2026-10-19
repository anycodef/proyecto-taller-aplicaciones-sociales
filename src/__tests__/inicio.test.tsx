import { render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import Inicio from "@/app/index";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";
import type { GestorSesion } from "@/plataforma/seguridad/sesion";

const gestorFalso = {
  activarEquipo: jest.fn(),
  fijarPin: jest.fn(),
  desbloquear: jest.fn(),
  entrarFamilia: jest.fn(),
  renovarSesion: jest.fn(),
} as unknown as GestorSesion;

afterEach(() => {
  jest.restoreAllMocks();
});

test("RF-101: sin sesión el inicio pide abrir el enlace personal", async () => {
  const replace = jest.spyOn(router, "replace").mockImplementation(() => undefined);

  render(
    <ProveedorSesion cargar={async () => null} gestor={gestorFalso}>
      <Inicio />
    </ProveedorSesion>
  );

  expect(await screen.findByText("Abre tu enlace personal")).toBeTruthy();
  expect(screen.getByText("SIGECAT")).toBeTruthy();
  expect(screen.getByText(/La coordinación te lo envía por WhatsApp/)).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});
