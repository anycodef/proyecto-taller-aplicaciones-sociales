import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import Anticipar from "@/app/(familia)/familia/anticipar";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import * as envio from "@/plataforma/justificaciones/enviar-justificacion";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn(() => () => undefined) },
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///cache/comunicado.jpg", width: 1200, height: 1600 }] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-familia", credencialId: "credencial-1", rolesPropios: ["familia"], gruposAsignados: [],
  catequizandosApoderados: ["nino-1", "nino-2"], identidadOperativa: "Familia", esMenor: false,
};
const respuestas = {
  "GET /familia/sesiones-anticipables": {
    cicloId: "c",
    sesiones: [
      { catequizandoId: "nino-1", sesionId: "misa-22", tipoSesion: "misa", fecha: "2026-11-22" },
      { catequizandoId: "nino-2", sesionId: "misa-22", tipoSesion: "misa", fecha: "2026-11-22" },
      { catequizandoId: "nino-1", sesionId: "misa-29", tipoSesion: "misa", fecha: "2026-11-29" },
    ],
  },
  "GET /familia/ausencias-justificables": { cicloId: "c", diasPlazo: 7, ninos: [{ catequizandoId: "nino-1", nombres: "Ana" }, { catequizandoId: "nino-2", nombres: "Luis" }], ausencias: [] },
};
const montar = () =>
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "familia", contexto })} cliente={crearClienteFalso(respuestas)}>
      <Anticipar />
    </ProveedorSesion>
  );

test("RF-404: solo ofrece la causa evento escolar y pide la foto del comunicado", async () => {
  const enviar = jest.spyOn(envio, "enviarJustificacion").mockResolvedValue({
    borrador: { evidenciaId: "e", loteId: "l", justificaciones: {}, intentos: 1 },
    lote: { loteId: "l", evidenciaId: "e", justificaciones: [] },
  });
  montar();
  await screen.findByText("Foto del comunicado del colegio");
  const chips = screen.getAllByRole("radio");
  expect(chips).toHaveLength(1);
  expect(screen.getByText("Evento escolar comunicado con anticipación")).toBeTruthy();
  expect(chips[0].props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByText("Ana · domingo 22 de noviembre"));
  fireEvent.press(screen.getByText("Tomar foto"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" }).props.accessibilityState?.disabled).toBeFalsy());
  fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(enviar).toHaveBeenCalled());
  expect(enviar.mock.calls[0][0]).toMatchObject({ causa: "evento_escolar", ausencias: [expect.objectContaining({ sesionId: "misa-22", anticipada: true })] });
});

test("RF-404: lista las sesiones futuras de cada hijo", async () => {
  montar();
  expect(await screen.findByText("Ana · domingo 22 de noviembre")).toBeTruthy();
  expect(screen.getByText("Luis · domingo 22 de noviembre")).toBeTruthy();
  expect(screen.getByText("Ana · domingo 29 de noviembre")).toBeTruthy();
});
