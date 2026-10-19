import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Print from "expo-print";

import CarnesDelGrupo from "@/app/(equipo)/coordinacion/grupos/[id]/carnes";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("expo-print", () => ({
  printAsync: jest.fn(async () => undefined),
  printToFileAsync: jest.fn(async () => ({ uri: "file://carne.pdf", numberOfPages: 1 })),
}));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-coordinacion",
  credencialId: "credencial-1",
  rolesPropios: ["coordinacion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Coordinación",
  esMenor: false,
};

const carnes = {
  carnes: [
    {
      catequizandoId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      nombres: "Mateo",
      apellidos: "Vargas",
      grupoId: "grupo-1",
      grupo: "Grupo A",
      emision: 1,
      codigoCarne: "SGC1:3f2504e0-4f89-41d3-9a0c-0305e82c3301:1",
    },
  ],
};

afterEach(() => {
  jest.clearAllMocks();
});

test("RF-302: la pantalla de carnés pide la hoja al servidor y la imprime", async () => {
  const cliente = crearClienteFalso({ "GET /grupos/grupo-1/carnes": carnes });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <CarnesDelGrupo id="grupo-1" />
    </ProveedorSesion>
  );

  expect(await screen.findByText("Mateo Vargas")).toBeTruthy();
  expect(cliente.llamadas.some((llamada) => llamada.ruta === "/grupos/grupo-1/carnes")).toBe(true);

  fireEvent.press(screen.getByText("Imprimir la hoja de carnés"));

  await waitFor(() => expect(Print.printToFileAsync).toHaveBeenCalled());

  const html = String((Print.printToFileAsync as jest.Mock).mock.calls[0]?.[0]?.html ?? "");
  expect(html).toContain("Mateo Vargas");
  expect(html).toContain("Grupo A");
  expect(html).toContain("<svg");
}, 20000);
