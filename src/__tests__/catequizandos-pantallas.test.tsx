import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import MisCatequizandos from "@/app/(equipo)/mis-catequizandos";
import PerfilCatequizando from "@/app/catequizandos/[id]";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { almacenVacio, type AlmacenLocal } from "@/lib/sincronizacion/almacen-local";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

let mockAlmacen: AlmacenLocal = almacenVacio();
let mockConexion = true;
jest.mock("@/plataforma/asistencia/contexto-asistencia", () => ({
  useAsistencia: () => ({ almacen: mockAlmacen, conConexion: mockConexion, cargando: false, sincronizando: false, sincronizarAhora: jest.fn() }),
}));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-cat",
  credencialId: "credencial-1",
  rolesPropios: ["catequista"],
  gruposAsignados: ["g1"],
  catequizandosApoderados: [],
  identidadOperativa: "Catequista demo",
  esMenor: false,
};

const conNomina = (): AlmacenLocal => ({
  ...almacenVacio(),
  colecciones: {
    grupos: { g1: { id: "g1", nombre: "Grupo demo", es_mio: true }, g2: { id: "g2", nombre: "Grupo B", es_mio: false } },
    catequizandos: {
      n1: { id: "n1", nombres: "Ana", apellidos: "Demo", grupo_id: "g1", activo: true },
      n2: { id: "n2", nombres: "Beto", apellidos: "Prueba", grupo_id: "g1", activo: true },
      n3: { id: "n3", nombres: "Carla", apellidos: "Otra", grupo_id: "g2", activo: true },
    },
  },
}) as unknown as AlmacenLocal;

const perfil = {
  catequizandoId: "n2", nombres: "Niño ficticio 2", apellidos: "Demostración", edad: 9, grupo: { id: "g1", nombre: "Grupo demo" },
  fechaNacimiento: "2017-01-01", sexo: "masculino", bautizado: false,
  documentos: [
    { id: "d1", tipo: "documento_identidad", estado: "pendiente", motivo: null, fechaEstado: "2026-11-12" },
    { id: "d2", tipo: "partida_bautismo", estado: "no_aplica", motivo: null, fechaEstado: "2026-11-12" },
  ],
  resumenes: { resumenAsistencia: { ausencias: 49, faltas: 4, domingos: [
    { fecha: "2026-11-08", misa: "ausente", catequesis: "ausente" },
    { fecha: "2026-11-01", misa: "ausente", catequesis: "ausente" },
    { fecha: "2026-11-15", misa: "pendiente", catequesis: "sin_registro" },
  ] } },
  apoderados: [{ id: "a1", nombres: "Familia ficticia", apellidos: "Demostración", relacion: "madre", detalleRelacion: null }],
  historialGrupos: [],
};

function montar(Pantalla: () => React.JSX.Element, respuestas: Record<string, unknown> = {}) {
  const cliente = crearClienteFalso(respuestas);
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <Pantalla />
    </ProveedorSesion>,
  );
  return cliente;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAlmacen = conNomina();
  mockConexion = true;
});

test("HU-101: el catequista ve sus grupos con sus niños y su grupo va primero", async () => {
  montar(MisCatequizandos);
  expect(await screen.findByText("3 niños en 2 grupos")).toBeTruthy();
  expect(screen.getByText("Mi grupo")).toBeTruthy();
  expect(screen.getByText("Ana Demo")).toBeTruthy();
  expect(screen.getByText("Carla Otra")).toBeTruthy();
});

test("HU-102: tocar a un niño abre su perfil", async () => {
  montar(MisCatequizandos);
  fireEvent.press(await screen.findByText("Beto Prueba"));
  expect(router.push).toHaveBeenCalledWith("/catequizandos/n2");
});

test("HU-101: se puede buscar por nombre sin tildes y avisa si nadie coincide", async () => {
  montar(MisCatequizandos);
  fireEvent.changeText(await screen.findByLabelText("Buscar por nombre"), "carla");
  expect(screen.getByText("Carla Otra")).toBeTruthy();
  expect(screen.queryByText("Ana Demo")).toBeNull();
  fireEvent.changeText(screen.getByLabelText("Buscar por nombre"), "zzz");
  expect(screen.getByText("Ningún niño coincide con la búsqueda.")).toBeTruthy();
});

test("RNF-306: sin conexión la lista se ve con la nómina guardada y lo avisa", async () => {
  mockConexion = false;
  montar(MisCatequizandos);
  expect(await screen.findByText(/Sin conexión\. Ves la nómina guardada/)).toBeTruthy();
  expect(screen.getByText("Ana Demo")).toBeTruthy();
});

test("RNF-306: sin nómina descargada ofrece sincronizar en vez de una lista vacía", async () => {
  mockAlmacen = almacenVacio();
  montar(MisCatequizandos);
  expect(await screen.findByText(/Todavía no hay niños descargados/)).toBeTruthy();
  expect(screen.getByText("Sincronizar ahora")).toBeTruthy();
});

test("RF-201: el perfil muestra grupo, edad, faltas, últimos domingos, documentos y apoderados", async () => {
  const cliente = montar(() => <PerfilCatequizando id="n2" />, { "GET /catequizandos/n2/perfil": perfil });
  expect(await screen.findByText("Niño ficticio 2 Demostración")).toBeTruthy();
  expect(screen.getByText("Grupo demo · 9 años")).toBeTruthy();
  expect(screen.getByText("4 faltas sin justificar")).toBeTruthy();
  expect(screen.getAllByText("Misa: Ausente")).toHaveLength(2);
  expect(screen.queryByText(/15 nov/)).toBeNull();
  expect(screen.getByText("Documento de identidad")).toBeTruthy();
  expect(screen.getByText("1 por entregar o corregir")).toBeTruthy();
  expect(screen.getByText("Familia ficticia Demostración")).toBeTruthy();
  expect(cliente.llamadas.map((l) => l.ruta)).toEqual(["/catequizandos/n2/perfil"]);
});

test("RF-204: el perfil nunca muestra imágenes ni el número de documento, solo estados", async () => {
  montar(() => <PerfilCatequizando id="n2" />, { "GET /catequizandos/n2/perfil": perfil });
  await screen.findByText("Niño ficticio 2 Demostración");
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/Contacto ficticio|salud|neurodivergen|"Image"/i);
});

test("RF-201: si el perfil no carga muestra el error y permite reintentar", async () => {
  montar(() => <PerfilCatequizando id="n2" />, { "GET /catequizandos/n2/perfil": new Error("sin red") });
  expect(await screen.findByText("No pudimos consultar el servidor. Revisa tu conexión.")).toBeTruthy();
  expect(screen.getByText("Reintentar")).toBeTruthy();
});
