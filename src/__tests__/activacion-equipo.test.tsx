import { render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import ActivacionEquipo from "@/app/acceso/equipo";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";
import type { ActivacionPendiente, GestorSesion } from "@/plataforma/seguridad/sesion";

jest.mock("expo-linking", () => ({
  ...jest.requireActual("expo-linking"),
  useURL: () => "https://sigecat.web/acceso/equipo#t=token-del-enlace",
}));

const activacion: ActivacionPendiente = {
  jwt: "jwt-de-equipo",
  credencialId: "credencial-1",
  tokenRenovacion: "token-de-renovacion",
  contexto: {
    cuentaId: "cuenta-1",
    credencialId: "credencial-1",
    rolesPropios: ["catequista"],
    gruposAsignados: [],
    catequizandosApoderados: [],
    identidadOperativa: "Luz",
    esMenor: true,
  },
};

const gestorFalso = {
  activarEquipo: jest.fn(async () => activacion),
  fijarPin: jest.fn(),
  desbloquear: jest.fn(),
  entrarFamilia: jest.fn(),
  renovarSesion: jest.fn(),
} as unknown as GestorSesion;

afterEach(() => {
  jest.restoreAllMocks();
});

test("RF-111: abrir el enlace del equipo activa la credencial y pasa a fijar el PIN", async () => {
  const replace = jest.spyOn(router, "replace").mockImplementation(() => undefined);

  render(
    <ProveedorSesion cargar={async () => null} gestor={gestorFalso}>
      <ActivacionEquipo />
    </ProveedorSesion>
  );

  await waitFor(() => expect(gestorFalso.activarEquipo).toHaveBeenCalledWith("token-del-enlace"));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/acceso/fijar-pin"));
});
