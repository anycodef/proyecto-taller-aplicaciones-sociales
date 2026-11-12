import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";

import { AVISO_DETALLE_SIN_CONEXION, ResumenJustificaciones, type EstadoJustificacion } from "@/components/justificaciones/resumen-justificaciones";

jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn(() => () => undefined) },
}));

const estados: EstadoJustificacion[] = [
  { id: "j-1", sesionId: "misa-8", tipoSesion: "misa", fecha: "2026-11-08", estado: "pendiente" },
  { id: "j-2", sesionId: "cat-1", tipoSesion: "catequesis", fecha: "2026-11-01", estado: "aprobada" },
  { id: "j-3", sesionId: "misa-25", tipoSesion: "misa", fecha: "2026-10-25", estado: "rechazada" },
  { id: "j-4", sesionId: "misa-18", tipoSesion: "misa", fecha: "2026-10-18", estado: "sin_efecto" },
];
const sinConexion = () => jest.mocked(NetInfo.fetch).mockResolvedValueOnce({ isConnected: false } as never);
const evidencia = { justificacionId: "j-1", evidenciaId: "ev-1", expiraEn: "2026-11-10T10:05:00Z", archivos: [{ orden: 1, url: "https://blob/ev-1/1.jpg" }] };

test("RF-410: el perfil muestra pendiente, aprobada, rechazada o sin efecto sin conexión", async () => {
  sinConexion();
  render(<ResumenJustificaciones estados={estados} />);
  expect(screen.getByText("Misa · domingo 8 de noviembre")).toBeTruthy();
  for (const etiqueta of ["En revisión", "Aceptada", "Rechazada", "Sin efecto"]) expect(screen.getByText(etiqueta)).toBeTruthy();
  await waitFor(() => expect(NetInfo.fetch).toHaveBeenCalled());
  expect(screen.queryByText(AVISO_DETALLE_SIN_CONEXION)).toBeNull();
});

test("RNF-405: el detalle y la evidencia piden conexión", async () => {
  sinConexion();
  const obtener = jest.fn(async () => evidencia);
  const sinRed = render(<ResumenJustificaciones estados={estados} obtenerEvidencia={obtener} />);
  expect(await screen.findByText(AVISO_DETALLE_SIN_CONEXION)).toBeTruthy();
  fireEvent.press(screen.getByText("Misa · domingo 8 de noviembre"));
  expect(obtener).not.toHaveBeenCalled();
  sinRed.unmount();

  render(<ResumenJustificaciones estados={estados} obtenerEvidencia={obtener} />);
  await waitFor(() => expect(screen.getAllByRole("button")[0].props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(screen.getByText("Misa · domingo 8 de noviembre"));
  await waitFor(() => expect(obtener).toHaveBeenCalledWith("j-1"));
});
