import { fireEvent, render, screen } from "@testing-library/react-native";

import NuevaCuenta from "@/app/(equipo)/cuentas/nueva";
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

function montar(cliente = crearClienteFalso({ "POST /cuentas": { id: "cuenta-nueva" } })) {
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <NuevaCuenta />
    </ProveedorSesion>
  );
  return cliente;
}

test("RF-105: el alta exige seudónimo si la persona es menor", async () => {
  const cliente = montar();

  fireEvent.changeText(screen.getByLabelText("Seudónimo"), "Ana Pérez");
  fireEvent.press(screen.getByText("Sí"));
  fireEvent.press(screen.getByText("Catequista"));
  fireEvent.changeText(screen.getByLabelText("Nombres reales"), "Ana");
  fireEvent.changeText(screen.getByLabelText("Apellidos reales"), "Pérez");
  fireEvent.press(screen.getByText("Crear la cuenta"));

  expect(
    await screen.findByText("Un menor necesita un seudónimo distinto de su nombre real.")
  ).toBeTruthy();
  expect(cliente.llamadas.filter((llamada) => llamada.ruta === "/cuentas")).toHaveLength(0);
});

test("RF-102: COORD solo puede elegir los roles catequista y familia", async () => {
  montar();

  expect(await screen.findByText("Catequista")).toBeTruthy();
  expect(screen.getByText("Familia")).toBeTruthy();
  expect(screen.queryByText("Administración")).toBeNull();
  expect(screen.queryByText("Supervisión")).toBeNull();
});
