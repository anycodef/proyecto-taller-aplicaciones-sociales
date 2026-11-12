import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import RegistroManual from "@/app/(equipo)/asistencia/manual";
import type { AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

const ninoPropio = "22222222-2222-4222-8222-222222222222";
const ninoAjeno = "33333333-3333-4333-8333-333333333333";
const sesionMisaId = "44444444-4444-4444-8444-444444444444";
/** Las 9:00 en Lima del domingo 19 de octubre de 2026, dentro de la ventana de misa. */
const ahora = Date.parse("2026-10-19T14:00:00.000Z");

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ isConnected: false })),
  },
}));

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

function discoFalso(nomina: AlmacenLocal) {
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

function nomina(): AlmacenLocal {
  return {
    ...almacenVacio(),
    colecciones: {
      grupos: { "grupo-1": { id: "grupo-1", nombre: "Grupo A", ciclo_id: "ciclo-1" } },
      catequizandos: {
        [ninoPropio]: {
          id: ninoPropio,
          nombres: "Mateo",
          apellidos: "Vargas",
          grupo_id: "grupo-1",
          codigo_carne: `SGC1:${ninoPropio}:1`,
          activo: true,
        },
        [ninoAjeno]: {
          id: ninoAjeno,
          nombres: "Ana",
          apellidos: "Torres",
          grupo_id: "grupo-2",
          codigo_carne: `SGC1:${ninoAjeno}:1`,
          activo: true,
        },
      },
      sesiones: {
        [sesionMisaId]: {
          id: sesionMisaId,
          ciclo_id: "ciclo-1",
          fecha: "2026-10-19",
          tipo: "misa",
          cancelada: false,
          ventana_inicio: "07:30:00",
          ventana_fin: "09:30:00",
        },
      },
    },
  };
}

function montar(disco: AlmacenLocalDisco) {
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
      cliente={{ solicitar: jest.fn() } as never}
    >
      <ProveedorAsistencia disco={disco}>
        <RegistroManual ahora={ahora} />
      </ProveedorAsistencia>
    </ProveedorSesion>
  );
}

test("RF-304: la búsqueda manual solo ofrece niños de los grupos propios", async () => {
  const disco = discoFalso(nomina());
  montar(disco);

  expect(await screen.findByText("Mateo Vargas")).toBeTruthy();
  expect(screen.queryByText("Ana Torres")).toBeNull();

  fireEvent.changeText(screen.getByLabelText("Buscar niño"), "torres");
  await waitFor(() => expect(screen.queryByText("Mateo Vargas")).toBeNull());
  expect(screen.queryByText("Ana Torres")).toBeNull();
});

test("RF-304: registro manual de un niño inscrito ese día queda marcado como manual", async () => {
  const disco = discoFalso(nomina());
  montar(disco);

  await screen.findByText("Mateo Vargas");
  fireEvent.press(screen.getByText("Registrar"));

  await waitFor(() => expect(screen.getByText("Registrado")).toBeTruthy());

  const marcas = disco.leer().pendientes.marcas;
  expect(marcas).toHaveLength(1);
  expect(marcas[0].fila.tipo_registro).toBe("manual");
  expect(marcas[0].fila.catequizando_id).toBe(ninoPropio);
  expect(marcas[0].fila.sesion_id).toBe(sesionMisaId);
  expect(marcas[0].fila.valor).toBe("presente");
});
