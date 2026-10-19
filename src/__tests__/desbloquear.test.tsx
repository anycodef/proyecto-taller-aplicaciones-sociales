import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import Desbloquear from "@/app/acceso/desbloquear";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { GestorSesion, ResultadoDesbloqueo } from "@/plataforma/seguridad/sesion";

const DIA = 86_400_000;

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-1",
  credencialId: "credencial-1",
  rolesPropios: ["catequista"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Luz",
  esMenor: true,
};

function gestorCon(resultado: ResultadoDesbloqueo) {
  return {
    activarEquipo: jest.fn(),
    fijarPin: jest.fn(),
    desbloquear: jest.fn(async () => resultado),
    entrarFamilia: jest.fn(),
    renovarSesion: jest.fn(),
  } as unknown as GestorSesion;
}

function montar(gestor: GestorSesion, ultimaRenovacion: number | null, bloqueada = false) {
  return render(
    <ProveedorSesion
      cargar={async () => ({
        tipo: "equipo",
        contexto,
        ultimaRenovacion: ultimaRenovacion ?? undefined,
        bloqueada,
        intentosFallidos: 0,
      })}
      gestor={gestor}
    >
      <Desbloquear />
    </ProveedorSesion>
  );
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test("RF-112: desbloquear muestra los días restantes sin conexión", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);
  const gestor = gestorCon({ estado: "operativa", intentosFallidos: 0, sesion: null, bloqueoReportado: false });

  montar(gestor, Date.now() - 5 * DIA);

  expect(await screen.findByText("Te quedan 9 días sin conexión")).toBeTruthy();
});

test("RF-112: en requiere-conexion no se permiten registros nuevos", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);
  const gestor = gestorCon({
    estado: "requiere-conexion",
    intentosFallidos: 0,
    sesion: null,
    bloqueoReportado: false,
  });

  montar(gestor, Date.now() - 20 * DIA);

  expect(await screen.findByText("Conéctate para seguir registrando")).toBeTruthy();
  expect(screen.getByText(/no podrás registrar asistencia nueva/)).toBeTruthy();
  expect(screen.queryByText("Ingresa tu PIN")).toBeNull();
  expect(screen.queryByLabelText("1")).toBeNull();
});

test("RF-111: al quinto fallo se pide un enlace nuevo", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);
  const gestor = gestorCon({
    estado: "bloqueada",
    intentosFallidos: 5,
    sesion: null,
    bloqueoReportado: true,
  });

  montar(gestor, Date.now() - 1 * DIA, true);

  expect(await screen.findByText("Este celular quedó bloqueado")).toBeTruthy();
  expect(screen.getByText(/Pide un enlace nuevo a la coordinación/)).toBeTruthy();
  expect(screen.queryByLabelText("1")).toBeNull();
});

test("RF-111: un PIN incorrecto avisa los intentos que quedan", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);
  const gestor = gestorCon({
    estado: "pin_invalido",
    intentosFallidos: 2,
    sesion: null,
    bloqueoReportado: false,
  });

  montar(gestor, Date.now() - 1 * DIA);

  await screen.findByText("Ingresa tu PIN");
  fireEvent.press(screen.getByLabelText("1"));
  fireEvent.press(screen.getByLabelText("2"));
  fireEvent.press(screen.getByLabelText("3"));
  fireEvent.press(screen.getByText("Continuar"));

  await waitFor(() => expect(screen.getByText("El PIN no es correcto. Te quedan 3 intentos.")).toBeTruthy());
});
