import { render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

import ActivacionEquipo from "@/app/acceso/equipo";
import {
  AVISO_PRIMERA_VEZ,
  ETIQUETA_ACTIVACION,
  TITULO_ACTIVACION,
} from "@/lib/seguridad/variantes-plataforma";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";
import type { GestorSesion } from "@/plataforma/seguridad/sesion";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("expo-linking", () => ({
  useURL: () => "https://sigecat.web/acceso/equipo#t=token-del-enlace",
}));

function simularPlataforma(platform: string) {
  Object.defineProperty(Platform, "OS", { value: platform, configurable: true });
}

const gestorSinRed = {
  activarEquipo: jest.fn(async () => {
    throw new Error("Network request failed");
  }),
  fijarPin: jest.fn(),
  desbloquear: jest.fn(),
  entrarFamilia: jest.fn(),
  renovarSesion: jest.fn(),
} as unknown as GestorSesion;

afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

test("RF-111: la web no muestra el aviso de primera vez al fallar el enlace", async () => {
  simularPlataforma("web");

  render(
    <ProveedorSesion gestor={gestorSinRed}>
      <ActivacionEquipo />
    </ProveedorSesion>
  );

  expect(await screen.findByText(TITULO_ACTIVACION.web)).toBeTruthy();
  expect(screen.getByText(ETIQUETA_ACTIVACION.web)).toBeTruthy();
  expect(screen.queryByText(AVISO_PRIMERA_VEZ.web ?? "")).toBeNull();
  expect(screen.queryByText(/La primera vez necesitas internet/)).toBeNull();
});

test("RF-111: la app del equipo sí muestra el aviso de primera vez", async () => {
  simularPlataforma("android");

  render(
    <ProveedorSesion gestor={gestorSinRed}>
      <ActivacionEquipo />
    </ProveedorSesion>
  );

  await waitFor(() => expect(screen.getByText(/La primera vez necesitas internet/)).toBeTruthy());
  expect(screen.getByText(ETIQUETA_ACTIVACION.app)).toBeTruthy();
});
