import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ListaCatequesis from "@/app/(equipo)/asistencia/lista/[grupoId]";
import type { AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

const ninoId = "22222222-2222-4222-8222-222222222222";
const sesionMisaId = "33333333-3333-4333-8333-333333333333";
const sesionCatequesisId = "44444444-4444-4444-8444-444444444444";
const sesionActividadId = "55555555-5555-4555-8555-555555555555";
/** Mediodia en Lima del domingo 19 de octubre de 2026. */
const ahora = Date.parse("2026-10-19T17:00:00.000Z");

const mockParametrosBusqueda: Record<string, string> = {};

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ isConnected: true })),
  },
}));

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParametrosBusqueda,
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

function nominaConDosNinos(): AlmacenLocal {
  return {
    ...almacenVacio(),
    colecciones: {
      grupos: { "grupo-1": { id: "grupo-1", nombre: "Grupo A", ciclo_id: "ciclo-1" } },
      catequizandos: {
        [ninoId]: {
          id: ninoId,
          nombres: "Mateo",
          apellidos: "Vargas",
          grupo_id: "grupo-1",
          codigo_carne: `SGC1:${ninoId}:1`,
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
        },
        [sesionCatequesisId]: {
          id: sesionCatequesisId,
          ciclo_id: "ciclo-1",
          fecha: "2026-10-19",
          tipo: "catequesis",
          cancelada: false,
        },
        [sesionActividadId]: {
          id: sesionActividadId,
          ciclo_id: "ciclo-1",
          fecha: "2026-10-20",
          tipo: "actividad",
          actividad_id: "actividad-1",
          cancelada: false,
        },
      },
    },
  };
}

function montar(disco: AlmacenLocalDisco, cliente: { solicitar: unknown }) {
  return render(
    <ProveedorSesion
      cargar={async () => ({
        tipo: "equipo",
        contexto: {
          cuentaId: "cuenta-1",
          credencialId: "credencial-1",
          rolesPropios: ["catequista"],
          gruposAsignados: ["grupo-1"],
          catequizandosApoderados: [],
          identidadOperativa: "Luz",
          esMenor: true,
        },
      })}
      cliente={cliente as never}
    >
      <ProveedorAsistencia disco={disco}>
        <ListaCatequesis grupoId="grupo-1" ahora={ahora} />
      </ProveedorAsistencia>
    </ProveedorSesion>
  );
}

beforeEach(() => {
  Object.keys(mockParametrosBusqueda).forEach((clave) => delete mockParametrosBusqueda[clave]);
});

test("RF-306: la lista abre con todos presentes y un toque lo pasa a ausente", async () => {
  const disco = discoFalso(nominaConDosNinos());
  montar(disco, { solicitar: jest.fn() });

  expect(await screen.findByText("Mateo Vargas")).toBeTruthy();
  expect(screen.getByText("Presente")).toBeTruthy();

  fireEvent.press(screen.getByText("Presente"));

  await waitFor(() => expect(screen.getByText("Ausente")).toBeTruthy());
});

test("RF-306: la lista marca sobre la sesión de catequesis de hoy y no sobre la primera descargada", async () => {
  const disco = discoFalso(nominaConDosNinos());
  montar(disco, { solicitar: jest.fn() });

  await screen.findByText("Mateo Vargas");
  fireEvent.press(screen.getByText("Confirmar lista"));

  await waitFor(() => expect(disco.leer().pendientes.marcas).toHaveLength(1));
  expect(disco.leer().pendientes.marcas[0].fila.sesion_id).toBe(sesionCatequesisId);
});

test("RF-306: con ?sesionId la lista registra sobre esa sesión", async () => {
  mockParametrosBusqueda.sesionId = sesionActividadId;
  const disco = discoFalso(nominaConDosNinos());
  montar(disco, { solicitar: jest.fn() });

  await screen.findByText("Mateo Vargas");
  fireEvent.press(screen.getByText("Confirmar lista"));

  await waitFor(() => expect(disco.leer().pendientes.marcas).toHaveLength(1));
  expect(disco.leer().pendientes.marcas[0].fila.sesion_id).toBe(sesionActividadId);
});

test("RF-306: sin sesión del ciclo la lista avisa y no deja confirmar", async () => {
  const disco = discoFalso(nominaConDosNinos());
  disco.leer().colecciones.sesiones = {};
  montar(disco, { solicitar: jest.fn() });

  await screen.findByText("Mateo Vargas");
  expect(screen.getByText("Hoy no hay catequesis de este grupo.")).toBeTruthy();
});

test("RF-307: al confirmar sin conexion la marca queda en el celular", async () => {
  const disco = discoFalso(nominaConDosNinos());
  const cliente = {
    solicitar: jest.fn(async (metodo: string, ruta: string) => {
      if (metodo === "GET" && ruta === "/sincronizacion/cambios") {
        throw new Error("Network request failed");
      }
      throw new Error("Network request failed");
    }),
  };

  montar(disco, cliente);

  await screen.findByText("Mateo Vargas");
  fireEvent.press(screen.getByText("Confirmar lista"));

  await waitFor(() => expect(screen.getByText("Lista guardada en el celular.")).toBeTruthy());

  const guardado = disco.leer();
  expect(guardado.pendientes.marcas).toHaveLength(1);
  expect(guardado.pendientes.marcas[0].fila.valor).toBe("presente");
  expect(guardado.pendientes.marcas[0].fila.catequizando_id).toBe(ninoId);
  expect(guardado.pendientes.marcas[0].fila.sesion_id).toBe(sesionCatequesisId);
});

test("RF-307: al volver la conexion se envia una sola vez y no quedan pendientes", async () => {
  const disco = discoFalso(nominaConDosNinos());
  const llamadas: string[] = [];
  const cliente = {
    solicitar: jest.fn(async (metodo: string, ruta: string) => {
      llamadas.push(`${metodo} ${ruta}`);
      if (metodo === "GET") return { changes: {}, timestamp: 1, huellaAlcance: "h" };
      return { aceptados: 1, rechazados: 0, descartadosCierre: 0 };
    }),
  };

  montar(disco, cliente);

  await screen.findByText("Mateo Vargas");
  fireEvent.press(screen.getByText("Confirmar lista"));

  await waitFor(() => expect(disco.leer().pendientes.marcas).toHaveLength(0));
  expect(llamadas.filter((llamada) => llamada === "POST /sincronizacion/cambios")).toHaveLength(1);
});
