import { useEffect } from "react";
import * as Crypto from "expo-crypto";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { router } from "expo-router";
import { Text } from "react-native";

import { useSesion, type ContextoSesionValor } from "@/plataforma/seguridad/contexto-sesion";
import type { Rol } from "@/lib/seguridad/contexto-acceso";

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

let sesionActual: ContextoSesionValor;

function InicioPrueba() {
  const sesion = useSesion();
  useEffect(() => {
    sesionActual = sesion;
  }, [sesion]);
  return <Text>Inicio de prueba</Text>;
}

async function montarConRoles(rolesPropios: Rol[], tipo: "equipo" | "familia" = "equipo", delegada = false) {
  mockSesiones.clear();
  const resultado = await renderRouter(
    { appDir: "src/app", overrides: { index: InicioPrueba } },
    { initialUrl: "/" }
  );
  await waitFor(() => expect(sesionActual.cargando).toBe(false));
  await act(async () => {
    sesionActual.iniciarSesion(tipo, {
      cuentaId: "cuenta-1", credencialId: "credencial-1", rolesPropios,
      gruposAsignados: [], catequizandosApoderados: [], identidadOperativa: "Luz", esMenor: false,
      ...(delegada ? { delegacionVigente: { id: "delegacion-1", hasta: "2030-01-01T00:00:00.000Z" } } : {}),
    }, "jwt");
  });
  return resultado;
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

afterEach(() => {
  jest.restoreAllMocks();
  mockSesiones.clear();
});

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

test("RF-101 RF-102: una familia no se restaura desde disco", async () => {
  mockSesiones.clear();
  mockLlamadas.length = 0;
  mockSesiones.set("cuenta-familia", sesionDeFamilia);

  const resultado = await renderRouter({ appDir: "src/app", overrides: {} }, { initialUrl: "/" });

  await waitFor(() => expect(mockLlamadas).toContain("listarCuentas"));
  await act(async () => { await Promise.resolve(); });

  const rutas = rutasVisibles(resultado.getRouterState());
  expect(rutas).not.toContain("(familia)");
  expect(rutas).not.toContain("(equipo)");
});

test.each(["/asistencia", "/cuentas", "/familia"])("RF-101 RF-111: disco no desbloquea la ruta directa %s", async (initialUrl) => {
  mockSesiones.set("cuenta-1", {
    ...sesionDeFamilia, tipo: "equipo", cuentaId: "cuenta-1",
    contexto: { ...sesionDeFamilia.contexto, rolesPropios: ["catequista", "familia"] },
    ultimaRenovacionServidor: Date.now(), pinSal: "sal", pinHash: "hash",
  });
  const resultado = await renderRouter({ appDir: "src/app", overrides: {} }, { initialUrl });
  await waitFor(() => expect(resultado.getPathname()).toBe("/acceso/desbloquear"));
  expect(rutasVisibles(resultado.getRouterState())).not.toContain("(equipo)");
  expect(rutasVisibles(resultado.getRouterState())).not.toContain("(familia)");
});

test.each([13, 15])("RF-101 RF-111 RF-112: el PIN habilita rutas y consulta el día %i sin red", async (dias) => {
  jest.spyOn(Crypto, "digestStringAsync").mockResolvedValue("hash");
  mockSesiones.set("cuenta-1", {
    ...sesionDeFamilia, tipo: "equipo", cuentaId: "cuenta-1",
    contexto: { ...sesionDeFamilia.contexto, rolesPropios: ["catequista", "familia"] },
    ultimaRenovacionServidor: Date.now() - dias * 86_400_000, pinSal: "sal", pinHash: "hash",
  });
  const resultado = await renderRouter({ appDir: "src/app", overrides: {} }, { initialUrl: "/asistencia" });
  await screen.findByText("Ingresa tu PIN");
  expect(rutasVisibles(resultado.getRouterState())).not.toContain("(equipo)");
  fireEvent.press(screen.getByLabelText("1"));
  fireEvent.press(screen.getByText("Continuar"));
  if (dias >= 14) {
    await screen.findByText("Conéctate para seguir registrando");
    fireEvent.press(screen.getByText("Abrir en modo consulta"));
  }
  await waitFor(() => expect(resultado.getPathname()).toBe("/asistencia"));
  expect(rutasVisibles(resultado.getRouterState())).toEqual(expect.arrayContaining(["(equipo)", "(familia)"]));
});

test("RF-102: familia en memoria no obtiene rutas del equipo", async () => {
  const resultado = await montarConRoles(["familia"], "familia");
  expect(rutasVisibles(resultado.getRouterState())).toContain("(familia)");
  expect(rutasVisibles(resultado.getRouterState())).not.toContain("(equipo)");
});

test("RF-102: equipo y familia obtienen la unión de rutas solo tras autenticar", async () => {
  const resultado = await montarConRoles(["catequista", "familia"]);
  expect(rutasVisibles(resultado.getRouterState())).toEqual(expect.arrayContaining(["(equipo)", "(familia)"]));
});

test.each(["/cuentas", "/cuentas/nueva", "/cuentas/cuenta-2", "/delegaciones", "/delegaciones/nueva", "/auditoria", "/avisos-sistema", "/coordinacion", "/coordinacion/grupos/grupo-1/carnes"])(
  "RF-102: catequista no puede abrir directamente %s", async (ruta) => {
    const resultado = await montarConRoles(["catequista"]);
    await act(async () => { router.push(ruta as "/cuentas"); });
    await waitFor(() => expect(resultado.getPathname()).not.toBe(ruta));
    expect(resultado.getPathname()).toBe("/asistencia");
  }
);

test.each([
  ["administracion", "/auditoria"], ["administracion", "/cuentas"],
  ["administracion", "/delegaciones"], ["coordinacion", "/cuentas"],
  ["coordinacion", "/delegaciones"], ["coordinacion", "/avisos-sistema"],
] as const)("RF-102: %s sí accede directamente a %s", async (rol, ruta) => {
  const resultado = await montarConRoles([rol]);
  await act(async () => { router.push(ruta); });
  await waitFor(() => expect(resultado.getPathname()).toBe(ruta));
});

test("RF-102: coordinación delegada gestiona cuentas pero no vuelve a delegar", async () => {
  const resultado = await montarConRoles(["catequista"], "equipo", true);
  await act(async () => { router.push("/cuentas"); });
  expect(resultado.getPathname()).toBe("/cuentas");
  await act(async () => { router.push("/delegaciones"); });
  expect(resultado.getPathname()).not.toBe("/delegaciones");
});
