import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";

import BandejaJustificaciones from "@/app/(equipo)/coordinacion/justificaciones/index";
import PlazoJustificacion from "@/app/(equipo)/coordinacion/justificaciones/plazo";
import { AVISO_SIN_CONEXION } from "@/lib/justificaciones/presentacion";
import { marcarBandejaDesactualizada } from "@/plataforma/justificaciones/bandeja-vigente";

import { loteEnBandeja, montarComoCoordinacion } from "./soporte/coordinacion";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn(() => () => undefined) },
}));

const ciclo = { id: "c-1", nombre: "Ciclo 2026", fechaInicio: "2026-03-01", fechaFin: "2026-12-31", estado: "abierto" };
const plazo = { cicloId: "c-1", diasPlazo: 7, predeterminado: true, definidoPor: null, definidoEn: null };
const sinConexion = () => jest.mocked(NetInfo.fetch).mockResolvedValueOnce({ isConnected: false } as never);

test("RF-405: la pantalla muestra el plazo vigente y guarda uno nuevo", async () => {
  const { cliente } = montarComoCoordinacion(<PlazoJustificacion />, {
    "GET /ciclos/abierto": ciclo,
    "GET /ciclos/c-1/plazo-justificacion": plazo,
    "PUT /ciclos/c-1/plazo-justificacion": { ...plazo, diasPlazo: 10, predeterminado: false },
  });
  expect(await screen.findByText("Plazo vigente: 7 días (predeterminado, aún no definido).")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Días desde la ausencia"), "10");
  fireEvent.press(screen.getByText("Guardar plazo"));
  expect(await screen.findByText("Plazo guardado: 10 días desde cada ausencia.")).toBeTruthy();
  expect(cliente.llamadas.find((l) => l.metodo === "PUT")).toEqual({ metodo: "PUT", ruta: "/ciclos/c-1/plazo-justificacion", cuerpo: { diasPlazo: 10 } });
  fireEvent.changeText(screen.getByLabelText("Días desde la ausencia"), "61");
  expect(screen.getByText("Entre 1 y 60 días.")).toBeTruthy();
});

test("RF-405: sin conexión avisa y no guarda nada", async () => {
  sinConexion();
  const { cliente } = montarComoCoordinacion(<PlazoJustificacion />, { "GET /ciclos/abierto": ciclo });
  expect(await screen.findByText(AVISO_SIN_CONEXION)).toBeTruthy();
  await waitFor(() => expect(cliente.llamadas).toHaveLength(0));
});

test("RF-408: la bandeja lista las pendientes por lote", async () => {
  montarComoCoordinacion(<BandejaJustificaciones />, { "GET /justificaciones/bandeja": { cicloId: "c-1", lotes: [loteEnBandeja] } });
  expect(await screen.findByText("Salud del niño")).toBeTruthy();
  expect(screen.getByText("Ana Quispe · domingo 8 de noviembre")).toBeTruthy();
  expect(screen.getByText("Luis Quispe · domingo 8 de noviembre")).toBeTruthy();
  expect(screen.getByText("Otra justificación para la misma ausencia")).toBeTruthy();
});

test("RF-403: aprobar varias seleccionadas envía todos los ids en una revisión", async () => {
  const { cliente } = montarComoCoordinacion(<BandejaJustificaciones />, {
    "GET /justificaciones/bandeja": { cicloId: "c-1", lotes: [loteEnBandeja] },
    "POST /justificaciones/revisiones": { revisadas: [{ id: "j-1", estado: "aprobada" }, { id: "j-2", estado: "aprobada" }] },
  });
  fireEvent.press(await screen.findByText("Ana Quispe · domingo 8 de noviembre"));
  fireEvent.press(screen.getByText("Luis Quispe · domingo 8 de noviembre"));
  fireEvent.press(screen.getByText("Aprobar seleccionadas (2)"));
  await waitFor(() => expect(cliente.llamadas.filter((l) => l.metodo === "POST")).toHaveLength(1));
  expect(cliente.llamadas.find((l) => l.metodo === "POST")?.cuerpo).toEqual({ ids: ["j-1", "j-2"], decision: "aprobada" });
});

test("RNF-405: sin conexión muestra un aviso y no lista nada guardado", async () => {
  sinConexion();
  const { cliente } = montarComoCoordinacion(<BandejaJustificaciones />, { "GET /justificaciones/bandeja": { cicloId: "c-1", lotes: [loteEnBandeja] } });
  expect(await screen.findByText(AVISO_SIN_CONEXION)).toBeTruthy();
  expect(screen.queryByText("Ana Quispe · domingo 8 de noviembre")).toBeNull();
  expect(cliente.llamadas).toHaveLength(0);
});

test("RF-408: supervisión ve la bandeja sin acciones de revisión", async () => {
  montarComoCoordinacion(<BandejaJustificaciones />, { "GET /justificaciones/bandeja": { cicloId: "c-1", lotes: [loteEnBandeja] } }, {
    cuentaId: "cuenta-parroco", credencialId: "credencial-2", rolesPropios: ["supervision"], gruposAsignados: [], catequizandosApoderados: [], identidadOperativa: "Párroco", esMenor: false,
  });
  expect(await screen.findByText("Ana Quispe · domingo 8 de noviembre · Misa")).toBeTruthy();
  expect(screen.queryByText(/Aprobar seleccionadas/)).toBeNull();
  expect(screen.queryByText("Registrar una justificación")).toBeNull();
});

test("RF-408: al volver del detalle tras revisar, la bandeja se recarga y ya no muestra el lote", async () => {
  const respuestas: Record<string, unknown> = { "GET /justificaciones/bandeja": { cicloId: "c-1", lotes: [loteEnBandeja] } };
  const { cliente } = montarComoCoordinacion(<BandejaJustificaciones />, respuestas);
  expect(await screen.findByText("Ana Quispe · domingo 8 de noviembre")).toBeTruthy();

  // El detalle revisó el lote completo y volvió con router.back(): la bandeja sigue montada.
  respuestas["GET /justificaciones/bandeja"] = { cicloId: "c-1", lotes: [] };
  act(() => marcarBandejaDesactualizada());

  expect(await screen.findByText("No hay justificaciones pendientes.")).toBeTruthy();
  expect(screen.queryByText("Ana Quispe · domingo 8 de noviembre")).toBeNull();
  expect(cliente.llamadas.filter((l) => l.ruta === "/justificaciones/bandeja")).toHaveLength(2);
});
