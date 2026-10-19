import { act, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

type EstadoRouter = ReturnType<ReturnType<typeof renderRouter>["getRouterState"]>;

const mockSesiones = new Map<string, unknown>();
const mockLlamadas: string[] = [];

jest.mock("@/plataforma/seguridad/almacen-seguro", () => ({
  ...jest.requireActual("@/plataforma/seguridad/almacen-seguro"),
  obtenerAlmacenSesion: () => ({
    obtenerDispositivoId: async () => "dispositivo-1",
    listarCuentas: async () => {
      mockLlamadas.push("listarCuentas");
      return [...mockSesiones.keys()];
    },
    registrarCuenta: async () => undefined,
    guardarSesion: async (sesion: { cuentaId: string }) => {
      mockSesiones.set(sesion.cuentaId, sesion);
    },
    leerSesion: async (cuentaId: string) => mockSesiones.get(cuentaId) ?? null,
    borrarSesion: async () => undefined,
  }),
}));

/** Rutas registradas en el navegador de la raiz: solo las visibles con la sesion actual. */
function rutasVisibles(estado: EstadoRouter): string[] {
  const interno = estado?.routes?.[0]?.state as { routeNames?: string[]; routes: { name: string }[] } | undefined;
  if (!interno) return [];
  return interno.routeNames ?? interno.routes.map((ruta) => ruta.name);
}

const sesionDeFamilia = {
  tipo: "familia",
  cuentaId: "cuenta-familia",
  credencialId: "credencial-familia",
  instanteMaximoVisto: Date.now(),
  intentosFallidos: 0,
  bloqueada: false,
  contexto: {
    rolesPropios: ["familia"],
    gruposAsignados: [],
    catequizandosApoderados: ["nino-1"],
    esMenor: false,
  },
};

test("RF-102: sin sesión no se muestran las rutas de (equipo) ni de (familia)", async () => {
  mockSesiones.clear();
  mockLlamadas.length = 0;

  const resultado = await renderRouter({ appDir: "src/app", overrides: {} }, { initialUrl: "/" });

  await waitFor(() => expect(mockLlamadas).toContain("listarCuentas"));
  await act(async () => {
    await Promise.resolve();
  });
  await waitFor(() => expect(rutasVisibles(resultado.getRouterState())).toContain("index"));

  const rutas = rutasVisibles(resultado.getRouterState());
  expect(rutas).not.toContain("(equipo)");
  expect(rutas).not.toContain("(familia)");
});

test("RF-102: una sesión de familia no muestra rutas de (equipo)", async () => {
  mockSesiones.clear();
  mockLlamadas.length = 0;
  mockSesiones.set("cuenta-familia", sesionDeFamilia);

  const resultado = await renderRouter({ appDir: "src/app", overrides: {} }, { initialUrl: "/" });

  await waitFor(() => expect(rutasVisibles(resultado.getRouterState())).toContain("(familia)"));

  const rutas = rutasVisibles(resultado.getRouterState());
  expect(rutas).toContain("(familia)");
  expect(rutas).not.toContain("(equipo)");
});
