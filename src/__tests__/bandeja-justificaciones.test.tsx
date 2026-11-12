import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import DetalleLote from "@/app/(equipo)/coordinacion/justificaciones/[loteId]";
import Bandeja from "@/app/(equipo)/coordinacion/justificaciones";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({ loteId: "lote-1" }),
    useFocusEffect: (efecto: () => void) => useEffect(efecto, [efecto]),
  };
});
jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");
  return { Image: (props: Record<string, unknown>) => <View testID="foto-evidencia" {...props} /> };
});
const mockRouter = router as unknown as { push: jest.Mock; back: jest.Mock };

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-coordinacion",
  credencialId: "credencial-1",
  rolesPropios: ["coordinacion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Coordinación demo",
  esMenor: false,
};

const fila = (id: string, sesion: "misa" | "catequesis", duplicada = false) => ({
  id, catequizandoId: "nino-2", nombre: "Niño ficticio 2", fecha: "2026-11-08", tipoSesion: sesion, causa: "salud_nino",
  enviadaEn: "2026-11-09T14:00:00.000Z", canal: "enlace", duplicada,
});
const bandeja = {
  lotes: [
    { loteId: "lote-1", justificaciones: [fila("j-1", "misa"), fila("j-2", "catequesis", true)] },
    { loteId: "lote-2", justificaciones: [{ ...fila("j-3", "misa"), nombre: "Niño ficticio 3" }] },
  ],
};

function montar(respuestas: Record<string, unknown>, Pantalla: () => React.JSX.Element) {
  const cliente = crearClienteFalso({ "GET /justificaciones/bandeja": bandeja, ...respuestas });
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <Pantalla />
    </ProveedorSesion>,
  );
  return cliente;
}

beforeEach(() => jest.clearAllMocks());

test("RF-408: la bandeja agrupa por lote, cuenta lo pendiente y marca la duplicada", async () => {
  montar({}, Bandeja);
  expect(await screen.findByText("3 por revisar en 2 lotes.")).toBeTruthy();
  expect(screen.getByText("Niño ficticio 3")).toBeTruthy();
  expect(screen.getByText("2 ausencias")).toBeTruthy();
  expect(screen.getByText("Posible duplicada")).toBeTruthy();
});

test("RF-403: tocar un lote abre su detalle", async () => {
  montar({}, Bandeja);
  fireEvent.press(await screen.findByText("Niño ficticio 3"));
  expect(mockRouter.push).toHaveBeenCalledWith("/coordinacion/justificaciones/lote-2");
});

test("RF-408: sin justificaciones pendientes lo dice", async () => {
  montar({ "GET /justificaciones/bandeja": { lotes: [] } }, Bandeja);
  expect(await screen.findAllByText("No hay justificaciones por revisar.")).not.toHaveLength(0);
});

test("RNF-403: ver evidencia pide la URL temporal de la primera justificación y la muestra sin caché", async () => {
  const cliente = montar({ "GET /justificaciones/j-1/evidencia": { url: "https://almacen/foto-1", urls: ["https://almacen/foto-1"], expiraEn: "2026-11-12T20:00:00.000Z" } }, DetalleLote);
  fireEvent.press(await screen.findByText("Ver evidencia"));
  const foto = await screen.findByTestId("foto-evidencia");
  expect(foto.props.cachePolicy).toBe("none");
  expect(foto.props.source).toEqual({ uri: "https://almacen/foto-1" });
  expect(cliente.llamadas.some((l) => l.ruta === "/justificaciones/j-1/evidencia")).toBe(true);
});

test("RF-406: aprobar todo el lote envía todas sus justificaciones y vuelve a la bandeja", async () => {
  const cliente = montar({ "POST /justificaciones/revisiones": { revisadas: [] } }, DetalleLote);
  fireEvent.press(await screen.findByText("Aprobar todo el lote"));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(cliente.llamadas.find((l) => l.ruta === "/justificaciones/revisiones")?.cuerpo).toEqual({ justificacionIds: ["j-1", "j-2"], decision: "aprobada" });
});

test("RF-406: se puede aprobar solo una selección y el lote sigue abierto con lo que falta", async () => {
  const cliente = montar({ "POST /justificaciones/revisiones": { revisadas: [] } }, DetalleLote);
  fireEvent.press((await screen.findAllByRole("checkbox"))[0]);
  fireEvent.press(await screen.findByText("Aprobar 1 seleccionada"));
  await waitFor(() => expect(cliente.llamadas.find((l) => l.ruta === "/justificaciones/revisiones")?.cuerpo).toEqual({ justificacionIds: ["j-1"], decision: "aprobada" }));
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test("RF-406: rechazar exige un motivo y lo envía con la decisión", async () => {
  const cliente = montar({ "POST /justificaciones/revisiones": { revisadas: [] } }, DetalleLote);
  fireEvent.press(await screen.findByText("Rechazar todo el lote"));
  expect(screen.getByRole("button", { name: "Confirmar rechazo" }).props.accessibilityState?.disabled).toBe(true);

  fireEvent.changeText(screen.getByLabelText("Motivo (la familia lo verá)"), "  La foto no se lee  ");
  fireEvent.press(screen.getByText("Confirmar rechazo"));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(cliente.llamadas.find((l) => l.ruta === "/justificaciones/revisiones")?.cuerpo).toEqual({
    justificacionIds: ["j-1", "j-2"], decision: "rechazada", motivo: "La foto no se lee",
  });
});

test("RF-406: si otra persona ya revisó la justificación avisa y no vuelve atrás", async () => {
  montar({ "POST /justificaciones/revisiones": Object.assign(new Error("no_pendiente"), { estado: 409, codigo: "no_pendiente" }) }, DetalleLote);
  fireEvent.press(await screen.findByText("Aprobar todo el lote"));
  expect(await screen.findByText(/Otra persona ya revisó esta justificación/)).toBeTruthy();
  expect(mockRouter.back).not.toHaveBeenCalled();
});
