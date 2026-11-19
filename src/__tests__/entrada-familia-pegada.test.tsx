import { render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import EntradaFamilia from "@/app/acceso/familia";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";
import { guardarTokenPendiente, type GestorSesion } from "@/plataforma/seguridad/sesion";

// En Expo Go la URL inicial es exp://… sin fragmento: el token llega pegado.
jest.mock("expo-linking", () => ({
  ...jest.requireActual("expo-linking"),
  useURL: () => "exp://127.0.0.1:8081",
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

afterEach(() => guardarTokenPendiente(null));

test("RF-110: la entrada de familia usa el token pegado cuando la URL no lo trae", async () => {
  guardarTokenPendiente("token-pegado");
  const replace = jest.spyOn(router, "replace").mockImplementation(() => undefined);

  render(
    <ProveedorSesion cargar={async () => null} gestor={gestorFalso}>
      <EntradaFamilia />
    </ProveedorSesion>
  );

  await waitFor(() => expect(entrarFamilia).toHaveBeenCalledWith("token-pegado"));
  expect(gestorFalso.activarEquipo).not.toHaveBeenCalled();
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/familia"));
});
