import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import Justificar from "@/app/(familia)/familia/justificar";
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
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///cache/foto.jpg", width: 4000, height: 3000 }] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-router", () => ({ ...jest.requireActual("expo-router"), useLocalSearchParams: () => ({ marcar: "nino-1|misa-8" }) }));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-familia", credencialId: "credencial-1", rolesPropios: ["familia"], gruposAsignados: [],
  catequizandosApoderados: ["nino-1", "nino-2"], identidadOperativa: "Familia", esMenor: false,
};
const respuestas = {
  "GET /familia/ausencias-justificables": {
    cicloId: "c", diasPlazo: 7, ninos: [{ catequizandoId: "nino-1", nombres: "Ana" }, { catequizandoId: "nino-2", nombres: "Luis" }],
    ausencias: [
      { catequizandoId: "nino-1", sesionId: "misa-8", tipoSesion: "misa", fecha: "2026-11-08", venceEn: "2026-11-15T23:59:59-05:00" },
      { catequizandoId: "nino-2", sesionId: "misa-8", tipoSesion: "misa", fecha: "2026-11-08", venceEn: "2026-11-15T23:59:59-05:00" },
    ],
  },
};
let enviar: jest.SpyInstance;
beforeEach(() => {
  enviar = jest.spyOn(envio, "enviarJustificacion").mockImplementation(async ({ borrador, ausencias }) => ({
    borrador,
    lote: { loteId: borrador.loteId, evidenciaId: borrador.evidenciaId, justificaciones: ausencias.map((a, i) => ({ ...a, id: `j-${i}`, anticipada: false, estado: "pendiente" as const })) },
  }));
  jest.spyOn(router, "replace").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const montar = () =>
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "familia", contexto })} cliente={crearClienteFalso(respuestas)}>
      <Justificar />
    </ProveedorSesion>
  );
const botonEnviar = () => screen.getByRole("button", { name: "Enviar" });

test("RNF-401: el flujo de la familia requiere a lo sumo 4 interacciones", async () => {
  montar();
  await screen.findByText("Ana · domingo 8 de noviembre");
  expect(screen.getAllByRole("checkbox")[0].props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByText("Salud del niño"));
  fireEvent.press(screen.getByText("Tomar foto"));
  await waitFor(() => expect(botonEnviar().props.accessibilityState?.disabled).toBeFalsy());
  fireEvent.press(botonEnviar());
  await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
  expect(enviar.mock.calls[0][0]).toMatchObject({ causa: "salud_nino", ausencias: [expect.objectContaining({ catequizandoId: "nino-1", sesionId: "misa-8" })], fotos: [{ uri: "file:///cache/foto.jpg", ancho: 4000, alto: 3000 }] });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/familia/enviada" })));
  expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ["images"], quality: 1 });
});

test("RF-402: Enviar está deshabilitado sin causa o sin foto", async () => {
  montar();
  await screen.findByText("Ana · domingo 8 de noviembre");
  expect(botonEnviar().props.accessibilityState?.disabled).toBe(true);
  fireEvent.press(screen.getByText("Salud del niño"));
  expect(botonEnviar().props.accessibilityState?.disabled).toBe(true);
  fireEvent.press(botonEnviar());
  expect(enviar).not.toHaveBeenCalled();
});

test("RF-403: se pueden añadir ausencias de otro hijo antes de enviar", async () => {
  montar();
  await screen.findByText("Luis · domingo 8 de noviembre");
  fireEvent.press(screen.getByText("Luis · domingo 8 de noviembre"));
  fireEvent.press(screen.getByText("Salud del niño"));
  fireEvent.press(screen.getByText("Tomar foto"));
  await waitFor(() => expect(botonEnviar().props.accessibilityState?.disabled).toBeFalsy());
  fireEvent.press(botonEnviar());
  await waitFor(() => expect(enviar).toHaveBeenCalled());
  expect(enviar.mock.calls[0][0].ausencias.map((a: { catequizandoId: string }) => a.catequizandoId)).toEqual(["nino-1", "nino-2"]);
});
