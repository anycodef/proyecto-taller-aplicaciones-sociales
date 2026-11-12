import { AppState, Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";

import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import type { AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ isConnected: false })),
  },
}));

const marcaId = "marca-1";

function discoConPendientes(): AlmacenLocalDisco {
  let estado: AlmacenLocal = {
    ...almacenVacio(),
    pendientes: {
      marcas: [
        {
          id: marcaId,
          fila: {
            id: marcaId,
            ciclo_id: "ciclo-1",
            sesion_id: "sesion-1",
            catequizando_id: "nino-1",
            valor: "presente",
            tipo_registro: "escaneo",
            lista_id: null,
            registrado_por: "cuenta-1",
            cuenta_id: "cuenta-1",
            credencial_id: "credencial-1",
            dispositivo_id: "dispositivo-1",
            hora_dispositivo: "2026-10-19T13:12:00.000Z",
            desfase_reloj_ms: 0,
          },
        },
      ],
      listas: [],
      correcciones: [],
    },
  };
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

function montar(disco: AlmacenLocalDisco, cliente: { solicitar: unknown }) {
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
      cliente={cliente as never}
    >
      <ProveedorAsistencia disco={disco}>
        <Text>Asistencia</Text>
      </ProveedorAsistencia>
    </ProveedorSesion>
  );
}

test("RF-307: al abrir la app se envia lo pendiente y al volver a primer plano tambien", async () => {
  const escuchas: ((estado: string) => void)[] = [];
  const espia = jest.spyOn(AppState, "addEventListener").mockImplementation((_evento, escucha) => {
    escuchas.push(escucha as (estado: string) => void);
    return { remove: jest.fn() } as never;
  });
  const llamadas: string[] = [];
  const cliente = {
    solicitar: jest.fn(async (metodo: string, ruta: string) => {
      llamadas.push(`${metodo} ${ruta}`);
      if (metodo === "GET") return { changes: {}, timestamp: 1, huellaAlcance: "h" };
      return { aceptados: 1, rechazados: 0, descartadosCierre: 0 };
    }),
  };

  montar(discoConPendientes(), cliente);
  await waitFor(() => expect(escuchas.length).toBeGreaterThan(0));
  // Al abrir la app ya se envio lo pendiente.
  await waitFor(() => expect(llamadas).toContain("POST /sincronizacion/cambios"));
  const sincronizacionesAlAbrir = llamadas.filter(
    (llamada) => llamada === "GET /sincronizacion/cambios"
  ).length;

  await act(async () => {
    escuchas[0]("active");
  });

  // Al volver a primer plano se sincroniza otra vez.
  await waitFor(() =>
    expect(llamadas.filter((llamada) => llamada === "GET /sincronizacion/cambios").length).toBe(
      sincronizacionesAlAbrir + 1
    )
  );
  espia.mockRestore();
});

test("RF-307: sin pendientes no se sincroniza al volver a primer plano", async () => {
  const escuchas: ((estado: string) => void)[] = [];
  const espia = jest.spyOn(AppState, "addEventListener").mockImplementation((_evento, escucha) => {
    escuchas.push(escucha as (estado: string) => void);
    return { remove: jest.fn() } as never;
  });
  const llamadas: string[] = [];
  const cliente = {
    solicitar: jest.fn(async (metodo: string, ruta: string) => {
      llamadas.push(`${metodo} ${ruta}`);
      if (metodo === "GET") return { changes: {}, timestamp: 1, huellaAlcance: "h" };
      return { aceptados: 0, rechazados: 0, descartadosCierre: 0 };
    }),
  };
  const disco: AlmacenLocalDisco = {
    leer: () => almacenVacio(),
    guardar: () => undefined,
    borrar: () => undefined,
  };

  montar(disco, cliente);
  await waitFor(() => expect(screen.getByText("Asistencia")).toBeTruthy());

  await act(async () => {
    escuchas.forEach(escucha => escucha("active"));
  });

  expect(llamadas).not.toContain("POST /sincronizacion/cambios");
  espia.mockRestore();
});
