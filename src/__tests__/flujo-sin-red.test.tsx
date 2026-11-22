import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ListaCatequesis from "@/app/(equipo)/asistencia/lista/[grupoId]";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import type { CambiosPorTabla, FilaSincronizada } from "@/lib/sincronizacion/protocolo";
import type { AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

const cicloId = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const sesionCatequesisId = "44444444-4444-4444-8444-444444444444";
const ninos = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
/** Domingo 18 de octubre de 2026, 10:30 en Lima: catequesis en curso. */
const ahora = Date.parse("2026-10-18T15:30:00.000Z");

const mockRed = { conectado: false, oyentes: [] as ((estado: { isConnected: boolean }) => void)[] };
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((oyente: (estado: { isConnected: boolean }) => void) => {
      mockRed.oyentes.push(oyente);
      return () => {
        mockRed.oyentes = mockRed.oyentes.filter((otro) => otro !== oyente);
      };
    }),
    fetch: jest.fn(async () => ({ isConnected: mockRed.conectado })),
  },
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

function nomina(): AlmacenLocal {
  const catequizandos: Record<string, FilaSincronizada> = {};
  ninos.forEach((id, indice) => {
    catequizandos[id] = { id, nombres: `Niño ${indice + 1}`, apellidos: "Prueba", grupo_id: "grupo-1", codigo_carne: null, activo: true };
  });
  return {
    ...almacenVacio(),
    colecciones: {
      grupos: { "grupo-1": { id: "grupo-1", nombre: "Grupo A", ciclo_id: cicloId, es_mio: true } },
      catequizandos,
      sesiones: {
        [sesionCatequesisId]: { id: sesionCatequesisId, ciclo_id: cicloId, fecha: "2026-10-18", tipo: "catequesis", cancelada: false },
      },
    },
  };
}

/** Disco en memoria que sobrevive a desmontar la pantalla, como el archivo del celular. */
function discoFalso(inicial: AlmacenLocal): AlmacenLocalDisco & { escrituras: number } {
  let texto = JSON.stringify(inicial);
  const disco = {
    escrituras: 0,
    leer: () => JSON.parse(texto) as AlmacenLocal,
    guardar: (estado: AlmacenLocal) => {
      disco.escrituras += 1;
      texto = JSON.stringify(estado);
    },
    borrar: () => {
      texto = JSON.stringify(almacenVacio());
    },
  };
  return disco;
}

/**
 * Servidor falso con la regla del real: cada fila se guarda por su id con
 * ON CONFLICT DO NOTHING. Puede guardar el lote y perder la respuesta, como
 * cuando la señal se cae a mitad del push.
 */
function servidorFalso() {
  const tablas: Record<string, Map<string, Record<string, unknown>>> = {
    listas_asistencia: new Map(),
    marcas_asistencia: new Map(),
  };
  const estado = { enLinea: false, perderRespuesta: false, posts: 0 };
  const cliente = {
    solicitar: jest.fn(async (metodo: string, ruta: string, cuerpo?: unknown) => {
      if (!estado.enLinea) throw new Error("Network request failed");
      if (metodo === "GET" && ruta.startsWith("/sincronizacion/cambios")) {
        const changes: CambiosPorTabla = {};
        for (const [tabla, filas] of Object.entries(tablas)) {
          changes[tabla] = {
            created: [...filas.values()].map((fila) => ({ ...fila, estado: "aceptada" }) as unknown as FilaSincronizada),
            updated: [],
            deleted: [],
          };
        }
        return { changes, timestamp: ahora, huellaAlcance: "huella-1" };
      }
      if (metodo === "POST" && ruta === "/sincronizacion/cambios") {
        estado.posts += 1;
        const lote = (cuerpo as { changes: Record<string, { created: Record<string, unknown>[] }> }).changes;
        let aceptados = 0;
        for (const [tabla, cambios] of Object.entries(lote)) {
          for (const fila of cambios.created) {
            if (!tablas[tabla]) continue;
            if (!tablas[tabla].has(String(fila.id))) tablas[tabla].set(String(fila.id), fila);
            aceptados += 1;
          }
        }
        if (estado.perderRespuesta) {
          estado.perderRespuesta = false;
          throw new Error("Network request failed");
        }
        return { aceptados, rechazados: 0, descartadosCierre: 0 };
      }
      throw new Error(`sin ruta ${metodo} ${ruta}`);
    }),
  };
  return { tablas, estado, cliente };
}

function montar(disco: AlmacenLocalDisco, cliente: { solicitar: unknown }) {
  return render(
    <ProveedorSesion
      cargar={async () => ({
        tipo: "equipo",
        contexto: {
          cuentaId: "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0",
          credencialId: "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0",
          dispositivoId: "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0",
          rolesPropios: ["catequista"],
          gruposAsignados: ["grupo-1"],
          catequizandosApoderados: [],
          identidadOperativa: "Luz",
          esMenor: true,
        },
      })}
      cliente={cliente as never}
      alCerrarSesion={() => undefined}
    >
      <ProveedorAsistencia disco={disco}>
        <ListaCatequesis grupoId="grupo-1" ahora={ahora} />
      </ProveedorAsistencia>
    </ProveedorSesion>
  );
}

async function cambiarRed(conectado: boolean) {
  mockRed.conectado = conectado;
  await act(async () => {
    mockRed.oyentes.forEach((oyente) => oyente({ isConnected: conectado }));
  });
}

beforeEach(() => {
  mockRed.conectado = false;
  mockRed.oyentes = [];
});

test("RF-306: sin red, cada toque de la lista queda en el celular y sobrevive a cerrar la pantalla", async () => {
  const disco = discoFalso(nomina());
  const { estado, cliente } = servidorFalso();
  estado.enLinea = false;

  const primera = montar(disco, cliente);
  await screen.findByText("Niño 2 Prueba");
  fireEvent.press(screen.getByLabelText("Niño 2 Prueba, presente. Toca para cambiar"));
  expect(await screen.findByLabelText("Niño 2 Prueba, ausente. Toca para cambiar")).toBeTruthy();
  primera.unmount();

  // Se vuelve a abrir la app: el toque sigue ahí y nada se envió.
  montar(disco, cliente);
  expect(await screen.findByLabelText("Niño 2 Prueba, ausente. Toca para cambiar")).toBeTruthy();
  expect(screen.getByLabelText("Niño 1 Prueba, presente. Toca para cambiar")).toBeTruthy();
  expect(disco.leer().pendientes.marcas).toHaveLength(0);
});

test("RNF-302: e2e lista sin red, vuelve la conexión y se sincroniza sin duplicados", async () => {
  const disco = discoFalso(nomina());
  const servidor = servidorFalso();

  montar(disco, servidor.cliente);
  await screen.findByText("Niño 2 Prueba");
  fireEvent.press(screen.getByLabelText("Niño 2 Prueba, presente. Toca para cambiar"));
  fireEvent.press(screen.getByText("Confirmar lista"));

  // Confirmada en el celular, sin red: la lista y una marca por niño esperan.
  expect(await screen.findByText("Lista confirmada")).toBeTruthy();
  expect(screen.getByText("2 presentes y 1 ausente en Grupo A.")).toBeTruthy();
  expect(screen.getByText("Se enviará cuando vuelva la señal")).toBeTruthy();
  expect(disco.leer().pendientes.listas).toHaveLength(1);
  expect(disco.leer().pendientes.marcas).toHaveLength(3);
  expect(disco.leer().colecciones.borradores_lista ?? {}).toEqual({});
  expect(servidor.estado.posts).toBe(0);

  // Vuelve la señal, pero se cae justo después de que el servidor guardó el
  // lote: el celular no recibió la respuesta y conserva todo.
  servidor.estado.enLinea = true;
  servidor.estado.perderRespuesta = true;
  await cambiarRed(true);
  await waitFor(() => expect(servidor.estado.posts).toBe(1));
  await waitFor(() => expect(disco.leer().pendientes.marcas).toHaveLength(3));

  // Segunda reconexión: reenvía el mismo lote con los mismos ids.
  await cambiarRed(false);
  await cambiarRed(true);
  await waitFor(() => expect(servidor.estado.posts).toBe(2));
  await waitFor(() => expect(disco.leer().pendientes.listas).toHaveLength(0));

  // 0 duplicados: el servidor tiene una lista y una marca por niño.
  expect(servidor.tablas.listas_asistencia.size).toBe(1);
  expect(servidor.tablas.marcas_asistencia.size).toBe(3);
  const valores = [...servidor.tablas.marcas_asistencia.values()].map((fila) => fila.valor).sort();
  expect(valores).toEqual(["ausente", "presente", "presente"]);
  expect(disco.leer().pendientes.marcas).toHaveLength(0);

  // Lo que el servidor confirmó vuelve en el pull: la pantalla ya no ofrece
  // confirmar otra vez y muestra la lista como enviada.
  expect(await screen.findByText("Enviada")).toBeTruthy();
  expect(screen.queryByText("Confirmar lista")).toBeNull();

  // Otra reconexión sin pendientes no vuelve a enviar nada.
  await cambiarRed(false);
  await cambiarRed(true);
  await waitFor(() => expect(servidor.cliente.solicitar).toHaveBeenCalled());
  expect(servidor.estado.posts).toBe(2);
  expect(servidor.tablas.marcas_asistencia.size).toBe(3);
});
