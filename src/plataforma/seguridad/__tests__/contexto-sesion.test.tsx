import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ProveedorSesion, useSesion, type SesionCargada } from "../contexto-sesion";

function Consumidor() {
  const sesion = useSesion();
  return (
    <>
      <Text testID="tipo">{sesion.tipo}</Text>
      <Text testID="roles">{sesion.rolesEfectivos.join(",")}</Text>
    </>
  );
}

test("RF-102: el proveedor de sesión expone los roles efectivos del contexto", async () => {
  const cargada: SesionCargada = {
    tipo: "equipo",
    contexto: {
      cuentaId: "cuenta-1",
      credencialId: "credencial-1",
      rolesPropios: ["catequista", "familia"],
      delegacionVigente: { id: "delegacion-1", hasta: "2030-01-01T00:00:00.000Z" },
      gruposAsignados: ["grupo-1"],
      catequizandosApoderados: ["nino-1"],
      identidadOperativa: "Luz",
      esMenor: true,
    },
  };

  render(
    <ProveedorSesion cargar={async () => cargada}>
      <Consumidor />
    </ProveedorSesion>
  );

  expect((await screen.findByTestId("roles")).props.children).toBe("catequista,familia,coordinacion");
  expect((await screen.findByTestId("tipo")).props.children).toBe("equipo");
});
