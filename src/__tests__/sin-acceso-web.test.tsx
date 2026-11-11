import { render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

import SinAcceso from "@/app/acceso/sin-acceso";
import {
  avisoRegistrosRechazados,
  AVISO_VARIOS_HIJOS,
} from "@/lib/seguridad/variantes-plataforma";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

function simularPlataforma(platform: string) {
  Object.defineProperty(Platform, "OS", { value: platform, configurable: true });
}

afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

test("RF-112: la web no avisa de registros no enviados y recuerda que el enlace sirve para todos", () => {
  simularPlataforma("web");

  render(<SinAcceso rechazados={3} />);

  expect(screen.getByText("No pudimos abrir tu acceso")).toBeTruthy();
  expect(screen.queryByText(/no pudieron enviarse/)).toBeNull();
  expect(screen.getByText(AVISO_VARIOS_HIJOS.web!)).toBeTruthy();
});

test("RF-112: la app del equipo avisa cuántos registros no pudieron enviarse", () => {
  simularPlataforma("android");

  render(<SinAcceso rechazados={3} />);

  expect(screen.getByText(/3 registros de este celular no pudieron enviarse/)).toBeTruthy();
  expect(screen.queryByText(AVISO_VARIOS_HIJOS.web!)).toBeNull();
});

test("RF-112: el aviso de registros usa el singular cuando es uno solo", () => {
  expect(avisoRegistrosRechazados("android", 1)).toContain("1 registro de este celular no pudo enviarse");
  expect(avisoRegistrosRechazados("android", 3)).toContain("3 registros de este celular no pudieron enviarse");
  expect(avisoRegistrosRechazados("web", 3)).toBeNull();
});
