import { render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import EntradaFamilia from "@/app/acceso/familia";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";
import type { GestorSesion } from "@/plataforma/seguridad/sesion";

jest.mock("expo-linking", () => ({
  ...jest.requireActual("expo-linking"),
  useURL: () => "https://sigecat.web/acceso/familia#t=token-de-familia",
}));

const escritas: { clave: string; valor: string }[] = [];

jest.mock("@/plataforma/seguridad/almacen-seguro", () => ({
  ...jest.requireActual("@/plataforma/seguridad/almacen-seguro"),
  obtenerAlmacenSesion: () => ({
    obtenerDispositivoId: async () => "dispositivo-1",
    listarCuentas: async () => [],
    registrarCuenta: async () => undefined,
    guardarSesion: async (sesion: { cuentaId: string; tokenRenovacion?: string }) => {
      escritas.push({ clave: sesion.cuentaId, valor: sesion.tokenRenovacion ?? "" });
    },
    leerSesion: async () => null,
    borrarSesion: async () => undefined,
  }),
}));

const entrarFamilia = jest.fn(async () => ({
  jwt: "jwt-de-familia",
  contexto: {
    cuentaId: "cuenta-familia",
    credencialId: "credencial-familia",
    rolesPropios: ["familia"] as const,
    gruposAsignados: [],
    catequizandosApoderados: ["nino-1"],
    identidadOperativa: "Familia",
    esMenor: false,
  },
}));

const gestorFalso = {
  activarEquipo: jest.fn(),
  fijarPin: jest.fn(),
  desbloquear: jest.fn(),
  entrarFamilia,
  renovarSesion: jest.fn(),
} as unknown as GestorSesion;

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  escritas.length = 0;
});

test("RF-110: la entrada de familia borra el fragmento de la URL y no guarda el token en almacenamiento", async () => {
  const replaceState = jest.fn();
  const original = { history: window.history, location: window.location };
  Object.assign(window, {
    history: { replaceState },
    location: { href: "https://sigecat.web/acceso/familia#t=token-de-familia" },
  });
  jest.spyOn(router, "replace").mockImplementation(() => undefined);

  try {
    render(
      <ProveedorSesion cargar={async () => null} gestor={gestorFalso}>
        <EntradaFamilia />
      </ProveedorSesion>
    );

    await waitFor(() => expect(entrarFamilia).toHaveBeenCalledWith("token-de-familia"));
    await waitFor(() => expect(replaceState).toHaveBeenCalled());

    const urlGuardada = String(replaceState.mock.calls[0]?.[2] ?? "");
    expect(urlGuardada).not.toContain("token-de-familia");
    expect(urlGuardada).not.toContain("#t=");
    expect(JSON.stringify(escritas)).not.toContain("token-de-familia");
  } finally {
    Object.assign(window, original);
  }
});
