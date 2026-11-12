import { render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";

import InicioFamilia from "@/app/(familia)/familia/index";
import { AVISO_SIN_CONEXION } from "@/lib/justificaciones/presentacion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn(() => () => undefined) },
}));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-familia", credencialId: "credencial-1", rolesPropios: ["familia"], gruposAsignados: [],
  catequizandosApoderados: ["nino-1"], identidadOperativa: "Familia", esMenor: false,
};
const respuestas = {
  "GET /familia/ausencias-justificables": {
    cicloId: "c", diasPlazo: 7, ninos: [{ catequizandoId: "nino-1", nombres: "Ana" }],
    ausencias: [
      { catequizandoId: "nino-1", sesionId: "misa-8", tipoSesion: "misa", fecha: "2026-11-08", venceEn: "2026-11-15T23:59:59-05:00" },
      { catequizandoId: "nino-1", sesionId: "cat-8", tipoSesion: "catequesis", fecha: "2026-11-08", venceEn: "2026-11-15T23:59:59-05:00" },
    ],
  },
  "GET /familia/justificaciones": {
    justificaciones: [
      { id: "j-1", catequizandoId: "nino-1", sesionId: "misa-1", tipoSesion: "misa", fecha: "2026-11-01", estado: "rechazada", motivoRechazo: "La foto no se lee", enviadaEn: "2026-11-02T10:00:00Z", origen: "usted", causa: "salud_nino" },
      { id: "j-2", catequizandoId: "nino-1", sesionId: "misa-0", tipoSesion: "misa", fecha: "2026-10-25", estado: "aprobada", motivoRechazo: null, enviadaEn: "2026-10-26T10:00:00Z", origen: "coordinacion", causa: "salud_nino" },
    ],
  },
};
const montar = (cliente = crearClienteFalso(respuestas)) =>
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "familia", contexto })} cliente={cliente}>
      <InicioFamilia />
    </ProveedorSesion>
  );

test("RF-401: la pantalla de familia lista primero las ausencias justificables", async () => {
  montar();
  expect(await screen.findByText("Ana · domingo 8 de noviembre")).toBeTruthy();
  // Las sesiones se muestran como etiquetas y el plazo como días que quedan hasta la fecha límite.
  expect(screen.getAllByText("Misa").length).toBeGreaterThan(0);
  expect(screen.getByText("Catequesis")).toBeTruthy();
  expect(screen.getByText(/(Quedan \d+ días|Queda 1 día|Vence hoy) · hasta el domingo 15 de noviembre/)).toBeTruthy();
  const texto = JSON.stringify(screen.toJSON());
  expect(texto.indexOf("Ausencias por justificar")).toBeLessThan(texto.indexOf("Mis justificaciones"));
  expect(texto.indexOf("domingo 8 de noviembre")).toBeLessThan(texto.indexOf("Mis justificaciones"));
});

test("RF-410: muestra el estado y, si fue rechazada, el motivo", async () => {
  montar();
  expect(await screen.findByText("Rechazada")).toBeTruthy();
  expect(screen.getByText("Motivo: La foto no se lee")).toBeTruthy();
  expect(screen.getByText("Aceptada")).toBeTruthy();
  expect(screen.getByText("Registrada por la coordinación")).toBeTruthy();
  expect(screen.queryAllByText(/^Motivo:/)).toHaveLength(1);
});

test("RF-410: misa y catequesis del mismo domingo con el mismo estado se ven en una sola tarjeta", async () => {
  const enviadas = [
    { id: "j-3", catequizandoId: "nino-1", sesionId: "misa-15", tipoSesion: "misa", fecha: "2026-11-15", estado: "pendiente", motivoRechazo: null, enviadaEn: "2026-11-16T10:00:00Z", origen: "usted", causa: "salud_nino" },
    { id: "j-4", catequizandoId: "nino-1", sesionId: "cat-15", tipoSesion: "catequesis", fecha: "2026-11-15", estado: "pendiente", motivoRechazo: null, enviadaEn: "2026-11-16T10:00:00Z", origen: "usted", causa: "salud_nino" },
  ];
  montar(crearClienteFalso({ ...respuestas, "GET /familia/justificaciones": { justificaciones: enviadas } }));
  expect(await screen.findByText("Ana · domingo 15 de noviembre")).toBeTruthy();
  expect(screen.getAllByText("En revisión")).toHaveLength(1);
});

test("RNF-404: sin conexión muestra un aviso y no guarda nada", async () => {
  jest.mocked(NetInfo.fetch).mockResolvedValueOnce({ isConnected: false } as never);
  const guardar = jest.spyOn(SecureStore, "setItemAsync");
  const cliente = crearClienteFalso(respuestas);
  montar(cliente);
  expect(await screen.findByText(AVISO_SIN_CONEXION)).toBeTruthy();
  await waitFor(() => expect(cliente.llamadas).toHaveLength(0));
  expect(guardar).not.toHaveBeenCalled();
});
