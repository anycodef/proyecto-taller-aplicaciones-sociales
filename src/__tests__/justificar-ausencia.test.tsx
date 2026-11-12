import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import Enviada from "@/app/(familia)/familia/enviada";
import Justificar from "@/app/(familia)/familia/justificar";
import MisJustificaciones from "@/app/(familia)/familia/mis-justificaciones";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { elegirFoto } from "@/plataforma/justificaciones/elegir-foto";
import { comprimirFoto } from "@/plataforma/justificaciones/comprimir-foto";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ cantidad: "2" }),
}));
const mockRouter = router as unknown as { replace: jest.Mock; push: jest.Mock; back: jest.Mock };
let mockContador = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockContador}` }));
jest.mock("@/plataforma/justificaciones/elegir-foto", () => ({ elegirFoto: jest.fn() }));
jest.mock("@/plataforma/justificaciones/comprimir-foto", () => ({ comprimirFoto: jest.fn() }));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-familia",
  credencialId: "credencial-1",
  rolesPropios: ["familia"],
  gruposAsignados: [],
  catequizandosApoderados: ["nino-1"],
  identidadOperativa: "Familia demo",
  esMenor: false,
};

const ausencias = {
  ausencias: [
    { catequizandoId: "nino-1", nombre: "Ana Demo", sesionId: "s-misa", tipoSesion: "misa", fecha: "2026-11-08", venceEn: "2026-11-15T23:59:59-05:00" },
    { catequizandoId: "nino-1", nombre: "Ana Demo", sesionId: "s-cat", tipoSesion: "catequesis", fecha: "2026-11-08", venceEn: "2026-11-15T23:59:59-05:00" },
  ],
};

const FOTO = { datos: new Uint8Array([0xff, 0xd8, 0xff]), bytes: 120 * 1024 };

function montar(respuestas: Record<string, unknown>, Pantalla: () => React.JSX.Element = Justificar) {
  const cliente = crearClienteFalso(respuestas);
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "familia", contexto })} cliente={cliente}>
      <Pantalla />
    </ProveedorSesion>,
  );
  return cliente;
}

async function prepararFormulario() {
  fireEvent.press(await screen.findByLabelText("Misa del 8 nov"));
  fireEvent.press(screen.getByLabelText("Catequesis del 8 nov"));
  fireEvent.press(screen.getByText("Salud del niño"));
  fireEvent.press(screen.getByText("Tomar foto"));
  await screen.findByText("Cambiar foto");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockContador = 0;
  (elegirFoto as jest.Mock).mockResolvedValue({ uri: "file:///camara/foto.jpg" });
  (comprimirFoto as jest.Mock).mockResolvedValue(FOTO);
});

test("RF-401: la familia ve las ausencias de su hijo y Enviar queda deshabilitado hasta tener ausencia, motivo y foto", async () => {
  montar({ "GET /familia/ausencias-justificables": ausencias });
  expect(await screen.findByText("Ana Demo")).toBeTruthy();
  expect(screen.getByLabelText("Misa del 8 nov")).toBeTruthy();
  expect(screen.getByLabelText("Catequesis del 8 nov")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Enviar justificación" }).props.accessibilityState?.disabled).toBe(true);
});

test("RF-403: elegir dos ausencias, motivo y foto envía la reserva, la subida y un lote con una justificación por ausencia", async () => {
  const cliente = montar({
    "GET /familia/ausencias-justificables": ausencias,
    "POST /evidencias/reservas": { evidenciaId: "ev-1", archivos: [{ orden: 1 }] },
    "POST /justificaciones/lotes": { loteId: "uuid-1", justificaciones: [{ id: "a" }, { id: "b" }] },
  });
  await prepararFormulario();
  fireEvent.press(screen.getByText("Enviar 2 justificaciones"));

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/familia/enviada?cantidad=2"));
  expect(cliente.llamadas.filter((l) => l.metodo === "POST").map((l) => l.ruta)).toEqual(["/evidencias/reservas", "/justificaciones/lotes"]);
  expect(cliente.binarios).toEqual([{ metodo: "PUT", ruta: "/evidencias/ev-1/archivos/1", contentType: "image/jpeg", datos: FOTO.datos }]);
  const lote = cliente.llamadas.find((l) => l.ruta === "/justificaciones/lotes")?.cuerpo as { causa: string; evidenciaId: string; ausencias: { sesionId: string; justificacionId: string }[] };
  expect(lote).toMatchObject({ causa: "salud_nino", evidenciaId: "ev-1" });
  expect(lote.ausencias.map((a) => a.sesionId)).toEqual(["s-misa", "s-cat"]);
  expect(new Set(lote.ausencias.map((a) => a.justificacionId)).size).toBe(2);
});

test("RNF-404: sin conexión muestra «No se envió», no avanza y no deja cola de reintento", async () => {
  const cliente = montar({
    "GET /familia/ausencias-justificables": ausencias,
    "POST /evidencias/reservas": new TypeError("Network request failed"),
  });
  await prepararFormulario();
  fireEvent.press(screen.getByText("Enviar 2 justificaciones"));

  expect(await screen.findByText(/^No se envió: no hay conexión/)).toBeTruthy();
  expect(screen.getByText("Reintentar envío")).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(cliente.binarios).toHaveLength(0);
  expect(cliente.llamadas.filter((l) => l.ruta === "/justificaciones/lotes")).toHaveLength(0);
});

test("RF-405: sin ausencias justificables explica que no hay nada que enviar", async () => {
  montar({ "GET /familia/ausencias-justificables": { ausencias: [] } });
  expect(await screen.findByText(/No tienes ausencias por justificar/)).toBeTruthy();
  expect(screen.queryByText("Tomar foto")).toBeNull();
});

test("RF-402: si se niega el permiso de la cámara se avisa y se ofrece la galería", async () => {
  (elegirFoto as jest.Mock).mockResolvedValueOnce({ denegado: true });
  montar({ "GET /familia/ausencias-justificables": ausencias });
  fireEvent.press(await screen.findByLabelText("Misa del 8 nov"));
  fireEvent.press(screen.getByText("Tomar foto"));
  expect(await screen.findByText(/Necesitamos permiso de la cámara/)).toBeTruthy();
  expect(screen.getByText("Elegir de la galería")).toBeTruthy();
});

test("RF-410: mis justificaciones muestra el estado con Insignia y el motivo si fue rechazada, sin foto", async () => {
  montar(
    {
      "GET /familia/justificaciones": {
        justificaciones: [
          { id: "1", catequizandoId: "nino-1", nombre: "Ana Demo", fecha: "2026-11-08", tipoSesion: "misa", causa: "salud_nino", estadoVisible: "pendiente", origen: "propia" },
          { id: "2", catequizandoId: "nino-1", nombre: "Ana Demo", fecha: "2026-11-01", tipoSesion: "catequesis", causa: "evento_escolar", estadoVisible: "rechazada", motivoRechazo: "La foto no se lee", origen: "otro_apoderado" },
        ],
      },
    },
    MisJustificaciones,
  );
  expect(await screen.findByText("En revisión")).toBeTruthy();
  expect(screen.getByText("Rechazada")).toBeTruthy();
  expect(screen.getByText("Motivo: La foto no se lee")).toBeTruthy();
  expect(screen.getByText("Enviada por otro apoderado")).toBeTruthy();
});

test("RF-403: la confirmación dice cuántas justificaciones se enviaron y no promete aprobación", () => {
  render(<Enviada />);
  expect(screen.getByText("Recibimos tu justificación")).toBeTruthy();
  expect(screen.getByText(/Enviaste 2 justificaciones\. La coordinación las revisará/)).toBeTruthy();
});
