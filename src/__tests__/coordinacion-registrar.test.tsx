import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import RegistrarJustificacion from "@/app/(equipo)/coordinacion/justificaciones/registrar";
import * as envio from "@/plataforma/justificaciones/enviar-justificacion";

import { montarComoCoordinacion } from "./soporte/coordinacion";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn(() => () => undefined) },
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///cache/whatsapp.jpg", width: 1080, height: 1920 }] })),
}));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));

test("RF-406: registra con niño, apoderado, ausencias, causa y foto recibida por otro medio", async () => {
  const enviar = jest.spyOn(envio, "enviarJustificacion").mockImplementation(async ({ borrador }) => ({ borrador, lote: { loteId: borrador.loteId, evidenciaId: borrador.evidenciaId, justificaciones: [] } }));
  jest.spyOn(router, "replace").mockImplementation(() => undefined);
  montarComoCoordinacion(<RegistrarJustificacion />, {
    "GET /ciclos/abierto": { ciclo: { id: "c-1", nombre: "Ciclo 2026", fechaInicio: "2026-03-01", fechaFin: "2026-12-31", estado: "abierto" } }, // el contrato es { ciclo }
    "GET /ciclos/c-1/grupos": { grupos: [{ id: "g-1", nombre: "Grupo A", cicloId: "c-1", edadMinima: 8, edadMaxima: 13, modalidad: "mixto", estado: "abierto", total: 1, sinCatequista: false }] },
    "GET /grupos/g-1/carnes": { carnes: [{ catequizandoId: "n-1", nombres: "Ana", apellidos: "Quispe", grupoId: "g-1", grupo: "Grupo A", emision: 1, codigoCarne: "SGC1:n-1:1" }] },
    "GET /coordinacion/catequizandos/n-1/ausencias-justificables": {
      cicloId: "c-1", diasPlazo: 7, nino: { catequizandoId: "n-1", nombre: "Ana Quispe" },
      apoderados: [{ apoderadoId: "ap-1", nombre: "Rosa Quispe", relacion: "madre" }],
      ausencias: [{ catequizandoId: "n-1", sesionId: "misa-8", tipoSesion: "misa", fecha: "2026-11-08", venceEn: "2026-11-15T23:59:59-05:00" }],
    },
  });
  fireEvent.press(await screen.findByText("Grupo A"));
  fireEvent.press(await screen.findByText("Ana Quispe"));
  fireEvent.press(await screen.findByText("Rosa Quispe"));
  expect(await screen.findByText("Registrar en nombre de Rosa Quispe")).toBeTruthy();
  fireEvent.press(screen.getByText("Ana Quispe · domingo 8 de noviembre"));
  fireEvent.press(screen.getByText("Enfermedad o fallecimiento de un familiar directo"));
  fireEvent.press(screen.getByText("Elegir de la galería"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" }).props.accessibilityState?.disabled).toBeFalsy());
  fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(enviar).toHaveBeenCalled());
  expect(enviar.mock.calls[0][0]).toMatchObject({
    apoderadoId: "ap-1", causa: "familiar_directo",
    ausencias: [expect.objectContaining({ catequizandoId: "n-1", sesionId: "misa-8", anticipada: false })],
    fotos: [{ uri: "file:///cache/whatsapp.jpg", ancho: 1080, alto: 1920 }],
  });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/coordinacion/justificaciones"));
});
