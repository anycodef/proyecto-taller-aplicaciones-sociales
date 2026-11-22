import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import Escanear from "@/app/(equipo)/asistencia/escanear";
import MenuAsistencia from "@/app/(equipo)/asistencia/index";
import AvisosAsistencia from "@/app/(equipo)/coordinacion/avisos-asistencia";
import SesionesDelCiclo from "@/app/(equipo)/coordinacion/sesiones";
import ReporteMisaPantalla from "@/app/(equipo)/reportes/misa/[fecha]";
import AsistenciaDeMiHijo from "@/app/(familia)/familia/asistencia/[catequizandoId]";
import type { Rol } from "@/lib/seguridad/contexto-acceso";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import type { AlmacenLocalDisco } from "@/plataforma/asistencia/almacen-local";
import { ProveedorAsistencia } from "@/plataforma/asistencia/contexto-asistencia";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

const cicloId = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const sesionMisaId = "33333333-3333-4333-8333-333333333333";
const sesionCatequesisId = "44444444-4444-4444-8444-444444444444";
const propio = "11111111-1111-4111-8111-111111111111";
const ajeno = "22222222-2222-4222-8222-222222222222";
const cuentaId = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
/** Domingo 18 de octubre de 2026, 8:10 en Lima: misa en curso. */
const enMisa = Date.parse("2026-10-18T13:10:00.000Z");

const mockRed = { conectado: false };
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => () => undefined),
    fetch: jest.fn(async () => ({ isConnected: mockRed.conectado })),
  },
}));
const mockNavegacion: string[] = [];
jest.mock("expo-router", () => ({
  router: { replace: jest.fn((ruta: string) => mockNavegacion.push(ruta)), push: jest.fn((ruta: string) => mockNavegacion.push(ruta)) },
  useLocalSearchParams: () => ({}),
  useIsFocused: () => true,
}));
const mockCamara: { props: Record<string, unknown> | null } = { props: null };
jest.mock("expo-camera", () => ({
  CameraView: (props: Record<string, unknown>) => {
    mockCamara.props = props;
    return null;
  },
  useCameraPermissions: () => [{ granted: true, status: "granted", canAskAgain: true, expires: "never" }, jest.fn()],
}));

function nomina(): AlmacenLocal {
  return {
    ...almacenVacio(),
    colecciones: {
      grupos: {
        "grupo-1": { id: "grupo-1", nombre: "Grupo A", ciclo_id: cicloId, es_mio: true },
        "grupo-2": { id: "grupo-2", nombre: "Grupo B", ciclo_id: cicloId, es_mio: false },
      },
      catequizandos: {
        [propio]: { id: propio, nombres: "Mateo", apellidos: "Vargas", grupo_id: "grupo-1", codigo_carne: `SGC1:${propio}:1`, activo: true },
        [ajeno]: { id: ajeno, nombres: "Ana", apellidos: "Pérez", grupo_id: "grupo-2", codigo_carne: `SGC1:${ajeno}:1`, activo: true },
      },
      sesiones: {
        [sesionMisaId]: { id: sesionMisaId, ciclo_id: cicloId, fecha: "2026-10-18", tipo: "misa", cancelada: false },
        [sesionCatequesisId]: { id: sesionCatequesisId, ciclo_id: cicloId, fecha: "2026-10-18", tipo: "catequesis", cancelada: false },
      },
    },
  };
}

function discoFalso(inicial: AlmacenLocal = nomina()): AlmacenLocalDisco {
  let estado = inicial;
  return { leer: () => estado, guardar: (nuevo) => { estado = nuevo; }, borrar: () => { estado = almacenVacio(); } };
}

function montar(
  hijo: ReactNode,
  { roles = ["catequista"], disco = discoFalso(), cliente = { solicitar: jest.fn(async () => { throw new Error("Network request failed"); }) }, tipo = "equipo", alCerrarSesion = jest.fn() }:
  { roles?: Rol[]; disco?: AlmacenLocalDisco; cliente?: { solicitar: jest.Mock }; tipo?: "equipo" | "familia"; alCerrarSesion?: jest.Mock } = {}
) {
  render(
    <ProveedorSesion
      cargar={async () => ({
        tipo,
        contexto: {
          cuentaId,
          credencialId: "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0",
          dispositivoId: "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0",
          rolesPropios: roles,
          gruposAsignados: ["grupo-1"],
          catequizandosApoderados: [],
          identidadOperativa: "Luz",
          esMenor: false,
        },
      })}
      cliente={cliente as never}
      alCerrarSesion={alCerrarSesion}
    >
      <ProveedorAsistencia disco={disco}>{hijo}</ProveedorAsistencia>
    </ProveedorSesion>
  );
  return { disco, cliente, alCerrarSesion };
}

beforeEach(() => {
  mockRed.conectado = false;
  mockCamara.props = null;
  mockNavegacion.length = 0;
});

async function leer(codigo: string) {
  await waitFor(() => expect(mockCamara.props?.onBarcodeScanned).toBeTruthy());
  await act(async () => {
    (mockCamara.props!.onBarcodeScanned as (lectura: { data: string; type: string }) => void)({ data: codigo, type: "qr" });
  });
}

describe("escanear", () => {
  test("RNF-305: escanear.tsx muestra el control de linterna y solicita solo QR", async () => {
    montar(<Escanear ahora={enMisa} />);
    await waitFor(() => expect(mockCamara.props).not.toBeNull());
    expect(mockCamara.props!.barcodeScannerSettings).toEqual({ barcodeTypes: ["qr"] });
    expect(mockCamara.props!.enableTorch).toBe(false);
    fireEvent.press(screen.getByLabelText("Encender linterna"));
    await waitFor(() => expect(mockCamara.props!.enableTorch).toBe(true));
  });

  test("RNF-302: sin red el escaneo guarda la marca pendiente y confirma con el nombre del niño propio", async () => {
    const { disco, cliente } = montar(<Escanear ahora={enMisa} />);
    await leer(`SGC1:${propio}:1`);

    expect(await screen.findByText("Mateo Vargas")).toBeTruthy();
    const marcas = disco.leer().pendientes.marcas;
    expect(marcas).toHaveLength(1);
    expect(marcas[0].fila).toMatchObject({ catequizando_id: propio, tipo_registro: "escaneo", valor: "presente", codigo_leido: `SGC1:${propio}:1` });
    expect(cliente.solicitar.mock.calls.some(([, ruta]) => String(ruta).includes("/validacion"))).toBe(false);
  });

  test("RNF-307: escanear a un niño de otro grupo muestra «Registrado» sin su nombre", async () => {
    montar(<Escanear ahora={enMisa} />);
    await leer(`SGC1:${ajeno}:1`);

    expect(await screen.findByText("Registrado")).toBeTruthy();
    expect(screen.queryByText("Ana Pérez")).toBeNull();
  });

  test("RF-302: el mismo código leído dentro de 2 s se ignora y un segundo escaneo no crea otra marca", async () => {
    const { disco } = montar(<Escanear ahora={enMisa} />);
    await leer(`SGC1:${propio}:1`);
    await leer(`SGC1:${propio}:1`);
    expect(disco.leer().pendientes.marcas).toHaveLength(1);
  });

  test("RF-302: el camino del escaneo no espera la red", async () => {
    mockRed.conectado = true;
    // Un servidor que nunca responde: la confirmación igual aparece.
    const cliente = { solicitar: jest.fn(() => new Promise<never>(() => undefined)) };
    const { disco } = montar(<Escanear ahora={enMisa} />, { cliente });
    await leer(`SGC1:${propio}:1`);
    expect(await screen.findByText("Mateo Vargas")).toBeTruthy();
    expect(disco.leer().pendientes.marcas).toHaveLength(1);
  });

  test("RF-303: sin red, un código desconocido queda pendiente de validar sin niño", async () => {
    const desconocido = "SGC1:99999999-9999-4999-8999-999999999999:1";
    const { disco } = montar(<Escanear ahora={enMisa} />);
    await leer(desconocido);
    expect(await screen.findByText("Carné no válido")).toBeTruthy();
    expect(disco.leer().pendientes.marcas[0].fila).toMatchObject({ catequizando_id: null, codigo_leido: desconocido });
  });
});

describe("menú y cierre de sesión", () => {
  test("RF-301: el menú muestra la misa en curso desde la base local sin red y enlaza escanear, manual y la lista", async () => {
    montar(<MenuAsistencia ahora={enMisa} />);
    expect(await screen.findByText("Misa en curso")).toBeTruthy();
    fireEvent.press(screen.getByText("Escanear carnés"));
    fireEvent.press(screen.getByText("Registrar a mano"));
    fireEvent.press(screen.getByText("Grupo B"));
    expect(mockNavegacion).toEqual(["/asistencia/escanear", "/asistencia/manual", "/asistencia/lista/grupo-2"]);
  });

  test("RF-307: cerrar sesión purga el almacén y conserva solo los pendientes", async () => {
    const { disco, alCerrarSesion } = montar(<MenuAsistencia ahora={enMisa} />);
    await screen.findByText("Cerrar sesión");
    fireEvent.press(screen.getByText("Cerrar sesión"));

    expect(alCerrarSesion).toHaveBeenCalledWith(cuentaId);
    await waitFor(() => expect(disco.leer().colecciones).toEqual({}));
  });
});

describe("coordinación", () => {
  test("RF-301: un catequista no ve la pantalla de domingos", async () => {
    montar(<SesionesDelCiclo />);
    expect(await screen.findByText("Solo la coordinación cambia los domingos del ciclo.")).toBeTruthy();
  });

  test("RF-301: la coordinación marca un domingo sin misa con motivo y queda pendiente de envío", async () => {
    const { disco } = montar(<SesionesDelCiclo />, { roles: ["coordinacion"] });
    fireEvent.press(await screen.findByText("18 de octubre"));
    fireEvent.press(screen.getAllByText("Sin realizar")[0]);
    fireEvent.press(screen.getByText("Guardar cambio"));
    expect(await screen.findByText("Escribe el motivo para marcar la sesión sin realizar.")).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("Por ejemplo: fiesta patronal"), "Fiesta patronal");
    fireEvent.press(screen.getByText("Guardar cambio"));

    await waitFor(() => expect(disco.leer().pendientes.sesiones).toHaveLength(1));
    expect(disco.leer().pendientes.sesiones[0].fila).toMatchObject({ id: sesionMisaId, cancelada: true, motivo_cancelacion: "Fiesta patronal" });
    expect(await screen.findByText("Sin misa")).toBeTruthy();
  });

  test("RF-310: la pantalla lista los avisos por tipo y marca uno como atendido", async () => {
    mockRed.conectado = true;
    const cliente = {
      solicitar: jest.fn(async (metodo: string, ruta: string) => {
        if (metodo === "GET" && ruta.startsWith("/asistencia/avisos")) {
          return [{ id: "aviso-1", tipo: "revision_cruzada", sesionId: sesionMisaId, catequizandoId: propio, marcaId: null, detalle: {}, estado: "abierto", atendidoEn: null, atendidoPor: null }];
        }
        if (metodo === "POST") return { atendido: true };
        throw new Error("Network request failed");
      }),
    };
    montar(<AvisosAsistencia />, { roles: ["coordinacion"], cliente });

    expect(await screen.findByText("Revisión cruzada")).toBeTruthy();
    expect(screen.getByText(/Vargas, Mateo estuvo en misa/)).toBeTruthy();
    fireEvent.press(screen.getByText("Marcar atendido"));
    await waitFor(() => expect(cliente.solicitar).toHaveBeenCalledWith("POST", "/asistencia/avisos/aviso-1/atencion"));
    expect(await screen.findByText("No hay avisos por atender.")).toBeTruthy();
  });

  test("RF-303: sin red la pantalla de avisos indica que requiere conexión", async () => {
    montar(<AvisosAsistencia />, { roles: ["coordinacion"] });
    expect(await screen.findByText("Los avisos de asistencia solo se consultan con conexión.")).toBeTruthy();
  });
});

describe("reporte de misa", () => {
  const reporte = {
    fecha: "2026-10-11", cancelada: false, totalPresentes: 2, totalActivos: 97, totalManuales: 1,
    presentes: [
      { catequizandoId: propio, nombre: "Mateo Vargas", horaDispositivo: "2026-10-11T13:02:00.000Z", recibidoEn: "2026-10-11T13:05:00.000Z", tipoRegistro: "escaneo", registradores: ["Luz"] },
      { catequizandoId: ajeno, nombre: "Ana Pérez", horaDispositivo: "2026-10-11T13:07:00.000Z", recibidoEn: "2026-10-11T13:07:30.000Z", tipoRegistro: "manual", registradores: ["Catequista 7"] },
    ],
  };

  test("RF-312: la pantalla muestra presentes frente a activos con hora, registrador y tipo", async () => {
    mockRed.conectado = true;
    const cliente = { solicitar: jest.fn(async (_metodo: string, ruta: string) => (ruta.includes("/reporte") ? reporte : Promise.reject(new Error("x")))) };
    montar(<ReporteMisaPantalla fecha="2026-10-11" />, { roles: ["supervision"], cliente });

    expect(await screen.findByText("2 de 97 niños presentes")).toBeTruthy();
    expect(cliente.solicitar).toHaveBeenCalledWith("GET", "/asistencia/misas/2026-10-11/reporte");
    expect(screen.getByText("8:02")).toBeTruthy();
    expect(screen.getByText("Registró Catequista 7 · llegó 8:07")).toBeTruthy();
    expect(screen.getByText("Manual")).toBeTruthy();
  });

  test("RF-304: la pantalla muestra cuántos registros fueron manuales", async () => {
    mockRed.conectado = true;
    const cliente = { solicitar: jest.fn(async () => reporte) };
    montar(<ReporteMisaPantalla fecha="2026-10-11" />, { roles: ["coordinacion"], cliente });
    expect(await screen.findByText("1 registro manual.")).toBeTruthy();
  });

  test("RF-312: sin red el reporte indica que requiere conexión", async () => {
    montar(<ReporteMisaPantalla fecha="2026-10-11" />, { roles: ["supervision"] });
    expect(await screen.findByText("El reporte de misa solo se consulta con conexión.")).toBeTruthy();
  });
});

describe("familia", () => {
  test("HU-306: la pantalla web muestra por domingo presente o ausente en misa y catequesis, de solo lectura", async () => {
    mockRed.conectado = true;
    const cliente = {
      solicitar: jest.fn(async (_metodo: string, ruta: string) => {
        if (ruta.includes("/domingos")) {
          return { domingos: [{ fecha: "2026-10-11", misa: "presente", catequesis: "ausente" }, { fecha: "2026-10-18", misa: "ausente", catequesis: "ausente" }], ausencias: 3, faltas: 1 };
        }
        return { cicloId, diasPlazo: 7, ninos: [{ catequizandoId: propio, nombres: "Mateo" }], ausencias: [] };
      }),
    };
    render(
      <ProveedorSesion
        cargar={async () => null}
        cliente={cliente as never}
      >
        <AsistenciaDeMiHijo catequizandoId={propio} />
      </ProveedorSesion>
    );

    expect(await screen.findByText("Asistencia de Mateo")).toBeTruthy();
    expect(screen.getByText("1 falta")).toBeTruthy();
    expect(screen.getAllByText("Presente")).toHaveLength(1);
    expect(screen.getAllByText("Ausente")).toHaveLength(3);
    // Solo lectura: no se muestra quién registró ni a qué hora (A-313).
    expect(screen.queryByText(/Registró/)).toBeNull();
    expect(cliente.solicitar).toHaveBeenCalledWith("GET", `/asistencia/catequizandos/${propio}/domingos`);
  });
});
