import { render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import SinAcceso from "@/app/acceso/sin-acceso";

afterEach(() => {
  jest.restoreAllMocks();
});

test("RF-101: sin-acceso muestra el mismo mensaje sea cual sea la causa", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);

  const { rerender } = render(<SinAcceso />);
  const mensaje = await screen.findByText("Este enlace ya no es válido. Pide uno nuevo a la coordinación.");

  rerender(<SinAcceso rechazados={0} />);
  expect(screen.getByText("Este enlace ya no es válido. Pide uno nuevo a la coordinación.")).toBeTruthy();

  expect(mensaje.props.children).toBe(
    "Este enlace ya no es válido. Pide uno nuevo a la coordinación."
  );
  expect(screen.queryByText(/revocado/)).toBeNull();
  expect(screen.queryByText(/desactivada/)).toBeNull();
});

test("RF-112: sin-acceso informa cuántos registros no pudieron enviarse", async () => {
  jest.spyOn(router, "replace").mockImplementation(() => undefined);

  render(<SinAcceso rechazados={3} />);

  expect(
    await screen.findByText(
      "3 registros de este celular no pudieron enviarse. La coordinación ya fue avisada."
    )
  ).toBeTruthy();
});
