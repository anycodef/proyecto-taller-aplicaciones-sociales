import { render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

import Inicio from "@/app/index";
import {
  muestraPegarEnlace,
  TARJETA_INICIO,
  varianteDe,
} from "@/lib/seguridad/variantes-plataforma";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

function simularPlataforma(platform: string) {
  Object.defineProperty(Platform, "OS", { value: platform, configurable: true });
}

afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

test("RF-101: la web no ofrece pegar el enlace y Android sí", () => {
  expect(varianteDe("web")).toBe("web");
  expect(varianteDe("android")).toBe("app");
  expect(varianteDe("ios")).toBe("app");

  expect(muestraPegarEnlace("android")).toBe(true);
  expect(muestraPegarEnlace("web")).toBe(false);
  expect(muestraPegarEnlace("ios")).toBe(false);

  expect(TARJETA_INICIO.web).toContain("sin instalar nada");
  expect(TARJETA_INICIO.app).toContain("la app se abre sola");
});

test("RF-101: sin sesión la portada web pide abrir el enlace personal sin pegarlo", async () => {
  simularPlataforma("web");

  render(
    <ProveedorSesion>
      <Inicio />
    </ProveedorSesion>
  );

  expect(await screen.findByText("Abre tu enlace personal")).toBeTruthy();
  expect(screen.getByText(TARJETA_INICIO.web)).toBeTruthy();
  expect(screen.queryByText("Pegar enlace")).toBeNull();
});

test("RF-101: en Android la portada ofrece pegar el enlace", async () => {
  simularPlataforma("android");

  render(
    <ProveedorSesion>
      <Inicio />
    </ProveedorSesion>
  );

  expect(await screen.findByText("Abre tu enlace personal")).toBeTruthy();
  expect(screen.getByText("Pegar enlace")).toBeTruthy();
});
