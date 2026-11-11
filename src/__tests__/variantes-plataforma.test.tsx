import { render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

import Inicio from "@/app/index";
import {
  AVISO_PRIMERA_VEZ,
  ETIQUETA_ACTIVACION,
  muestraPegarEnlace,
  TARJETA_INICIO,
  TEXTO_ACTIVACION,
  TITULO_ACTIVACION,
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

test("RF-111: la web usa su propia etiqueta y su propio texto de activación", () => {
  expect(ETIQUETA_ACTIVACION.web).toBe("ENTRANDO");
  expect(ETIQUETA_ACTIVACION.app).toBe("ACTIVAR MI CUENTA");

  expect(TITULO_ACTIVACION.web).toBe("Abriendo tu enlace…");
  expect(TITULO_ACTIVACION.app).toBe("Verificando tu enlace…");

  expect(TEXTO_ACTIVACION.web).toBe("Esto toma unos segundos.");
  expect(TEXTO_ACTIVACION.app).toContain("No cierres la app");
});

test("RF-111: el aviso de la primera vez es solo de la app del equipo", () => {
  expect(AVISO_PRIMERA_VEZ.web).toBeNull();
  expect(AVISO_PRIMERA_VEZ.app).toContain("La primera vez necesitas internet");
});
