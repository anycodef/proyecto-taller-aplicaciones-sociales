import { render, screen } from "@testing-library/react-native";

import FichaCuenta from "@/app/(equipo)/cuentas/[id]";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: "cuenta-9" }),
}));

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-admin",
  credencialId: "credencial-1",
  rolesPropios: ["administracion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Administración",
  esMenor: false,
};

test("RNF-105: la ficha de cuenta toma el id del parámetro de ruta y no consulta la lista de cuentas", async () => {
  const cliente = crearClienteFalso({
    "GET /cuentas/cuenta-9": { id: "cuenta-9", identidadOperativa: "Luz demo", esMenor: true, activa: true, roles: ["catequista"] },
  });
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <FichaCuenta />
    </ProveedorSesion>,
  );
  expect(await screen.findByText("Generar enlace del equipo")).toBeTruthy();
  expect(cliente.llamadas.map((l) => l.ruta)).toEqual(["/cuentas/cuenta-9"]);
});
