import { render, screen } from "@testing-library/react-native";

import { ConfirmacionEscaneo } from "@/components/asistencia/confirmacion-escaneo";

test("RF-302: un niño de sus grupos muestra su nombre en un banner verde a pantalla completa", () => {
  render(<ConfirmacionEscaneo estado="registrado" nombre="Mateo Vargas" hora="8:12" />);

  expect(screen.getByText("Mateo Vargas")).toBeTruthy();
  expect(screen.getByText("Registrado en misa a las 8:12")).toBeTruthy();
});

test("RNF-307: escanear a un niño de otro grupo muestra «Registrado» sin su nombre", () => {
  render(<ConfirmacionEscaneo estado="otro_grupo" nombre="Ana Torres" hora="8:12" />);

  expect(screen.getByText("Registrado")).toBeTruthy();
  expect(screen.queryByText("Ana Torres")).toBeNull();
});

test("RF-302: muestra «Ya estaba registrado»", () => {
  render(<ConfirmacionEscaneo estado="ya_registrado" />);

  expect(screen.getByText("Ya estaba registrado")).toBeTruthy();
  expect(screen.getByText("Este carné ya se escaneó en esta misa.")).toBeTruthy();
});

test("RF-303: muestra «Carné no válido»", () => {
  render(<ConfirmacionEscaneo estado="invalido" />);

  expect(screen.getByText("Carné no válido")).toBeTruthy();
  expect(
    screen.getByText("No se registró. Sin conexión, se guarda y se valida al sincronizar.")
  ).toBeTruthy();
});
