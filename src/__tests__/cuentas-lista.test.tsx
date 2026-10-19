import { render, screen } from "@testing-library/react-native";

import ListaCuentas from "@/app/(equipo)/cuentas/index";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-coordinacion",
  credencialId: "credencial-1",
  rolesPropios: ["coordinacion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Coordinación",
  esMenor: false,
};

test("RNF-105: COORD ve desde el celular las cuentas que gestiona", async () => {
  const cliente = crearClienteFalso({
    "GET /cuentas": {
      cuentas: [
        { id: "cuenta-1", identidadOperativa: "Luz", esMenor: true, activa: true, roles: ["catequista"] },
        { id: "cuenta-2", identidadOperativa: "Los Andes", esMenor: false, activa: true, roles: ["familia"] },
      ],
    },
  });

  render(
    <ProveedorSesion
      cargar={async () => ({ tipo: "equipo", contexto })}
      cliente={cliente}
    >
      <ListaCuentas />
    </ProveedorSesion>
  );

  expect(await screen.findByText("Luz")).toBeTruthy();
  expect(screen.getByText("Los Andes")).toBeTruthy();
  expect(screen.getByText("Catequista")).toBeTruthy();
  expect(screen.getByText("Familia")).toBeTruthy();
  expect(screen.queryByText("Administración")).toBeNull();
});
