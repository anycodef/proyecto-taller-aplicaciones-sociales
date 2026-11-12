import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import MenuAsistencia from "@/app/(equipo)/asistencia/index";
import ListaCatequesis from "@/app/(equipo)/asistencia/lista/[grupoId]";
import Pendientes from "@/app/(equipo)/asistencia/pendientes";
import type { AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

const sesionCatequesisId = "44444444-4444-4444-8444-444444444444";
/** Las 10:00 en Lima del domingo 18 de octubre de 2026. */
const ahora = Date.parse("2026-10-18T15:00:00.000Z");

const mockNavegacion: string[] = [];

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ isConnected: false })),
  },
}));

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn((ruta: string) => mockNavegacion.push(ruta)),
    push: jest.fn((ruta: string) => mockNavegacion.push(ruta)),
  },
  useLocalSearchParams: () => ({}),
}));

function discoFalso(nomina: AlmacenLocal): AlmacenLocalDisco {
  let estado = nomina;
  return {
    leer: () => estado,
    guardar: (nuevo: AlmacenLocal) => {
      estado = nuevo;
    },
    borrar: () => {
      estado = almacenVacio();
    },
  };
}

function nominaDemo(): AlmacenLocal {
  const catequizandos: Record<string, { id: string } & Record<string, string | number | boolean | null>> = {};
  for (let numero = 1; numero <= 8; numero += 1) {
    const id = `2222222${numero}-2222-4222-8222-222222222222`;
    catequizandos[id] = {
      id,
      nombres: `Niño ${numero}`,
      apellidos: "Demo",
      grupo_id: "grupo-1",
      codigo_carne: `SGC1:${id}:1`,
      activo: true,
    };
  }
  return {
    ...almacenVacio(),
    colecciones: {
      grupos: { "grupo-1": { id: "grupo-1", nombre: "Grupo Demo", ciclo_id: "ciclo-1" } },
      catequizandos,
      sesiones: {
        [sesionCatequesisId]: {
          id: sesionCatequesisId,
          ciclo_id: "ciclo-1",
          fecha: "2026-10-18",
          tipo: "catequesis",
          cancelada: false,
        },
      },
    },
  };
}

function montar(disco: AlmacenLocalDisco, pantalla: React.ReactNode) {
  return render(
    <ProveedorSesion
      cargar={async () => ({
        tipo: "equipo",
        contexto: {
          cuentaId: "cuenta-1",
          credencialId: "credencial-1",
          dispositivoId: "dispositivo-1",
          rolesPropios: ["catequista"],
          gruposAsignados: ["grupo-1"],
          catequizandosApoderados: [],
          identidadOperativa: "Luz",
          esMenor: true,
        },
      })}
      cliente={
        { solicitar: jest.fn(async () => { throw new Error("Network request failed"); }) } as never
      }
    >
      <ProveedorAsistencia disco={disco}>{pantalla}</ProveedorAsistencia>
    </ProveedorSesion>
  );
}

beforeEach(() => {
  mockNavegacion.length = 0;
});

test("RF-306: el menú ofrece los grupos y lleva a la lista", async () => {
  const disco = discoFalso(nominaDemo());
  montar(disco, <MenuAsistencia />);

  const grupo = await screen.findByText("Grupo Demo");
  fireEvent.press(grupo);

  expect(mockNavegacion).toContain("/asistencia/lista/grupo-1");
});

test("RF-306: la lista se confirma sin conexión y deja la lista y las marcas pendientes", async () => {
  const disco = discoFalso(nominaDemo());
  montar(disco, <ListaCatequesis grupoId="grupo-1" ahora={ahora} />);

  await screen.findByText("Niño 1 Demo");
  fireEvent.press(screen.getByLabelText("Niño 2 Demo, presente. Toca para cambiar"));
  fireEvent.press(screen.getByText("Confirmar lista"));

  await waitFor(() => expect(screen.getByText("Lista guardada en el celular.")).toBeTruthy());

  const guardado = disco.leer();
  expect(guardado.pendientes.listas).toHaveLength(1);
  expect(guardado.pendientes.marcas).toHaveLength(8);
  expect(guardado.pendientes.marcas.filter((marca) => marca.fila.valor === "ausente")).toHaveLength(1);
});

test("RF-307: el menú cuenta lo que falta por enviar y la pantalla los lista", async () => {
  const disco = discoFalso(nominaDemo());
  montar(disco, <ListaCatequesis grupoId="grupo-1" ahora={ahora} />);
  await screen.findByText("Niño 1 Demo");
  fireEvent.press(screen.getByText("Confirmar lista"));
  await waitFor(() => expect(disco.leer().pendientes.marcas).toHaveLength(8));

  const menu = montar(disco, <MenuAsistencia />);
  await waitFor(() => expect(menu.getByText("9 registros por enviar")).toBeTruthy());

  const vista = montar(disco, <Pendientes />);
  await waitFor(() => expect(vista.getByText("Niño 1 Demo")).toBeTruthy());
  expect(vista.queryByText("Pendiente de prototipado")).toBeNull();
});
