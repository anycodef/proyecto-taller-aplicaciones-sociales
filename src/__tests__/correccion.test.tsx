import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";

import CorregirAsistencia from "@/app/(equipo)/asistencia/correccion/[sesionId]/[catequizandoId]";
import type { AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

const ninoId = "22222222-2222-4222-8222-222222222222";
const sesionMisaId = "44444444-4444-4444-8444-444444444444";
const cuentaCatequista = "55555555-5555-4555-8555-555555555555";
const credencialCatequista = "66666666-6666-4666-8666-666666666666";
/** Las 8:12 en Lima del domingo 11 de octubre de 2026. */
const dentroDelDomingo = Date.parse("2026-10-11T13:12:00.000Z");
/** El lunes 12 de octubre de 2026: el domingo ya termino. */
const despuesDelDomingo = Date.parse("2026-10-13T14:00:00.000Z");

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
        [ninoId]: {
          id: ninoId,
          nombres: "Daniela Sofía",
          apellidos: "Castro Ramírez",
          grupo_id: "grupo-1",
          codigo_carne: `SGC1:${ninoId}:1`,
          activo: true,
        },
      },
      sesiones: {
        [sesionMisaId]: {
          id: sesionMisaId,
          ciclo_id: "ciclo-1",
          fecha: "2026-10-11",
          tipo: "misa",
          cancelada: false,
        },
      },
    },
    pendientes: {
      marcas: [
        {
          id: "marca-1",
          fila: {
            id: "marca-1",
            ciclo_id: "ciclo-1",
            sesion_id: sesionMisaId,
            catequizando_id: ninoId,
            valor: "ausente",
            tipo_registro: "escaneo",
            lista_id: null,
            registrado_por: cuentaCatequista,
            cuenta_id: cuentaCatequista,
            credencial_id: credencialCatequista,
            dispositivo_id: "dispositivo-1",
            hora_dispositivo: "2026-10-11T13:12:00.000Z",
            desfase_reloj_ms: 0,
          },
        },
      ],
      listas: [],
      correcciones: [],
    },
  };
}

function montar(
  disco: AlmacenLocalDisco,
  roles: ("catequista" | "coordinacion")[],
  cuentaId = cuentaCatequista,
  instante = dentroDelDomingo
) {
  return render(
    <ProveedorSesion
      cargar={async () => ({
        tipo: "equipo",
        contexto: {
          cuentaId,
          credencialId: credencialCatequista,
          dispositivoId: "dispositivo-1",
          rolesPropios: roles,
          gruposAsignados: ["grupo-1"],
          catequizandosApoderados: [],
          identidadOperativa: "Luz",
          esMenor: true,
        },
      })}
      cliente={{ solicitar: jest.fn() } as never}
    >
      <ProveedorAsistencia disco={disco}>
        <CorregirAsistencia
          sesionId={sesionMisaId}
          catequizandoId={ninoId}
          ahora={instante}
        />
      </ProveedorAsistencia>
    </ProveedorSesion>
  );
}

test("RF-309: la pantalla muestra el valor actual y el anterior", async () => {
  const disco = discoFalso(nomina());
  montar(disco, ["catequista"]);

  expect(await screen.findByText("Daniela Sofía Castro Ramírez")).toBeTruthy();
  expect(screen.getByText("Valor anterior")).toBeTruthy();
  expect(within(screen.getByTestId("valor-anterior")).getByText("Ausente")).toBeTruthy();
  expect(screen.getByText("Nuevo valor")).toBeTruthy();
});

test("RF-309: la pantalla exige motivo a la coordinación después del fin del domingo", async () => {
  const disco = discoFalso(nomina());
  montar(disco, ["coordinacion"], "77777777-7777-4777-8777-777777777777", despuesDelDomingo);

  await screen.findByText("Daniela Sofía Castro Ramírez");
  expect(screen.getByText("Terminó el domingo: solo la coordinación corrige y debe indicar el motivo.")).toBeTruthy();

  fireEvent.press(screen.getByText("Guardar corrección"));

  await waitFor(() => expect(screen.getByText("Indica el motivo de la corrección.")).toBeTruthy());
  expect(disco.leer().pendientes.correcciones).toHaveLength(0);
});

test("RF-309: otro catequista no ve la acción de corregir", async () => {
  const disco = discoFalso(nomina());
  montar(disco, ["catequista"], "88888888-8888-4888-8888-888888888888");

  await screen.findByText("Daniela Sofía Castro Ramírez");
  expect(screen.queryByText("Guardar corrección")).toBeNull();
});

test("RF-309: quien registró puede corregir antes de que termine el domingo", async () => {
  const disco = discoFalso(nomina());
  montar(disco, ["catequista"]);

  await screen.findByText("Daniela Sofía Castro Ramírez");
  fireEvent.press(screen.getByText("Presente"));
  fireEvent.press(screen.getByText("Guardar corrección"));

  await waitFor(() => expect(disco.leer().pendientes.correcciones).toHaveLength(1));
  const correccion = disco.leer().pendientes.correcciones[0].fila;
  expect(correccion.valor_anterior).toBe("ausente");
  expect(correccion.valor_nuevo).toBe("presente");
  expect(correccion.catequizando_id).toBe(ninoId);
  expect(correccion.sesion_id).toBe(sesionMisaId);
});
