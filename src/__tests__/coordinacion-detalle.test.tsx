import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";

import DetalleLote from "@/app/(equipo)/coordinacion/justificaciones/[loteId]";
import { VisorEvidencia } from "@/components/justificaciones/visor-evidencia";
import { AVISO_SIN_CONEXION } from "@/lib/justificaciones/presentacion";

import { loteEnBandeja, montarComoCoordinacion } from "./soporte/coordinacion";

const imagenes: { source: { uri: string }; cachePolicy: string }[] = [];
jest.mock("expo-image", () => ({ Image: (props: { source: { uri: string }; cachePolicy: string }) => { imagenes.push(props); return null; } }));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn(() => () => undefined) },
}));
jest.mock("expo-router", () => ({ ...jest.requireActual("expo-router"), useLocalSearchParams: () => ({ loteId: "lote-1" }) }));

const evidencia = { justificacionId: "j-1", evidenciaId: "ev-1", expiraEn: "2026-11-10T10:05:00Z", archivos: [{ orden: 1, url: "https://blob/c/ev-1/1.jpg?sp=r&rscc=no-store" }] };
const respuestas = {
  "GET /justificaciones/bandeja": { cicloId: "c-1", lotes: [loteEnBandeja] },
  "GET /justificaciones/j-1/evidencia": evidencia,
  "POST /justificaciones/revisiones": { revisadas: [] },
};
beforeEach(() => { imagenes.length = 0; });

test("RNF-403: el visor usa cachePolicy none y pide una SAS nueva al abrir", async () => {
  const obtener = jest.fn(async () => evidencia);
  const primera = render(<VisorEvidencia justificacionId="j-1" obtener={obtener} />);
  await waitFor(() => expect(imagenes.length).toBeGreaterThan(0));
  primera.unmount();
  render(<VisorEvidencia justificacionId="j-1" obtener={obtener} />);
  await waitFor(() => expect(obtener).toHaveBeenCalledTimes(2));
  expect(imagenes.every((i) => i.cachePolicy === "none" && i.source.uri === evidencia.archivos[0].url)).toBe(true);
});

test("RNF-405: sin conexión muestra un aviso y no pide la evidencia", async () => {
  jest.mocked(NetInfo.fetch).mockResolvedValueOnce({ isConnected: false } as never);
  const obtener = jest.fn(async () => evidencia);
  render(<VisorEvidencia justificacionId="j-1" obtener={obtener} />);
  expect(await screen.findByText(AVISO_SIN_CONEXION)).toBeTruthy();
  expect(obtener).not.toHaveBeenCalled();
});

test("RF-410: muestra la evidencia del lote", async () => {
  const { cliente } = montarComoCoordinacion(<DetalleLote />, respuestas);
  await waitFor(() => expect(imagenes.some((i) => i.source.uri === evidencia.archivos[0].url)).toBe(true));
  expect(cliente.llamadas.some((l) => l.ruta === "/justificaciones/j-1/evidencia")).toBe(true);
});

test("RF-408: rechazar exige escribir un motivo de hasta 280 caracteres", async () => {
  const { cliente } = montarComoCoordinacion(<DetalleLote />, respuestas);
  // El motivo se pide al elegir rechazar; sin motivo no se envía nada.
  fireEvent.press(await screen.findByRole("button", { name: "Rechazar todo" }));
  const campo = await screen.findByLabelText("Motivo del rechazo");
  expect(campo.props.maxLength).toBe(280);
  const confirmar = screen.getByRole("button", { name: "Confirmar rechazo" });
  expect(confirmar.props.accessibilityState?.disabled).toBe(true);
  fireEvent.press(confirmar);
  expect(cliente.llamadas.some((l) => l.metodo === "POST")).toBe(false);
  fireEvent.changeText(campo, "  La foto no se lee  ");
  fireEvent.press(screen.getByRole("button", { name: "Confirmar rechazo" }));
  await waitFor(() => expect(cliente.llamadas.find((l) => l.metodo === "POST")?.cuerpo).toEqual({ ids: ["j-1", "j-2"], decision: "rechazada", motivo: "La foto no se lee" }));
});

test("RF-403: se puede aprobar solo una ausencia del lote", async () => {
  const { cliente } = montarComoCoordinacion(<DetalleLote />, respuestas);
  await screen.findByText("Luis Quispe · domingo 8 de noviembre");
  // Una tarjeta por niño y fecha, en el orden del lote: Ana y luego Luis.
  fireEvent.press(screen.getAllByRole("button", { name: "Aprobar" })[1]);
  await waitFor(() => expect(cliente.llamadas.find((l) => l.metodo === "POST")?.cuerpo).toEqual({ ids: ["j-2"], decision: "aprobada" }));
});

test("RF-403: se puede rechazar solo una ausencia del lote, con su motivo", async () => {
  const { cliente } = montarComoCoordinacion(<DetalleLote />, respuestas);
  await screen.findByText("Ana Quispe · domingo 8 de noviembre");
  fireEvent.press(screen.getAllByRole("button", { name: "Rechazar" })[0]);
  expect(await screen.findByText("Rechazar: Ana Quispe · domingo 8 de noviembre")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Motivo del rechazo"), "No corresponde a esa fecha");
  fireEvent.press(screen.getByRole("button", { name: "Confirmar rechazo" }));
  await waitFor(() => expect(cliente.llamadas.find((l) => l.metodo === "POST")?.cuerpo).toEqual({ ids: ["j-1"], decision: "rechazada", motivo: "No corresponde a esa fecha" }));
});
