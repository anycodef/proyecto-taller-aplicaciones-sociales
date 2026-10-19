import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { useEffect } from "react";

import FijarPin from "@/app/acceso/fijar-pin";
import { ProveedorSesion, useSesion } from "@/plataforma/seguridad/contexto-sesion";
import type { ActivacionPendiente, GestorSesion } from "@/plataforma/seguridad/sesion";

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

const fijarPin = jest.fn(async () => ({}) as never);
const gestorFalso = {
  activarEquipo: jest.fn(),
  fijarPin,
  desbloquear: jest.fn(),
  entrarFamilia: jest.fn(),
  renovarSesion: jest.fn(),
} as unknown as GestorSesion;

/** Deja la activacion pendiente como si el enlace ya se hubiera validado. */
function Banco() {
  const sesion = useSesion();
  useEffect(() => {
    sesion.guardarActivacion(activacion);
  }, [sesion]);
  return <FijarPin />;
}

function escribir(digitos: string) {
  for (const digito of digitos) fireEvent.press(screen.getByLabelText(digito));
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test("RF-111: fijar-pin rechaza 3 o 7 dígitos y exige confirmar el PIN", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);

  render(
    <ProveedorSesion cargar={async () => null} gestor={gestorFalso}>
      <Banco />
    </ProveedorSesion>
  );

  await screen.findByText("Crea tu PIN");

  escribir("123");
  fireEvent.press(screen.getByText("Continuar"));
  expect(await screen.findByText("El PIN debe tener de 4 a 6 dígitos.")).toBeTruthy();

  escribir("4");
  fireEvent.press(screen.getByText("Continuar"));
  expect(await screen.findByText("Repite tu PIN")).toBeTruthy();

  escribir("9999");
  fireEvent.press(screen.getByText("Guardar PIN"));
  expect(await screen.findByText("Los dos PIN no son iguales.")).toBeTruthy();
  expect(fijarPin).not.toHaveBeenCalled();

  for (let intento = 0; intento < 4; intento += 1) fireEvent.press(screen.getByLabelText("Borrar"));
  escribir("1234");
  fireEvent.press(screen.getByText("Guardar PIN"));
  await waitFor(() => expect(fijarPin).toHaveBeenCalledWith(activacion, "1234"));
});

test("RF-111: el PIN no puede tener más de 6 dígitos", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);

  render(
    <ProveedorSesion cargar={async () => null} gestor={gestorFalso}>
      <Banco />
    </ProveedorSesion>
  );

  await screen.findByText("Crea tu PIN");

  escribir("1234567");

  expect(screen.getByLabelText("6 de 6 dígitos")).toBeTruthy();
});
