import { render } from "@testing-library/react-native";

import { TarjetaCarne } from "@/components/catequizandos/tarjeta-carne";
import { matrizQr } from "@/lib/catequizandos/carne";

const mockRectes: { fill?: string }[] = [];

jest.mock("react-native-svg", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children?: unknown }) => React.createElement(View, null, children as never),
    Rect: (props: { fill?: string }) => {
      mockRectes.push(props);
      return React.createElement(View, null);
    },
  };
});

const codigo = "SGC1:3f2504e0-4f89-41d3-9a0c-0305e82c3301:1";

beforeEach(() => {
  mockRectes.length = 0;
});

test("RF-302: codigo-qr pinta tantos módulos oscuros como la matriz", () => {
  const matriz = matrizQr(codigo);

  render(
    <TarjetaCarne nombres="Mateo" apellidos="Vargas" grupo="Grupo A" emision={1} codigoCarne={codigo} />
  );

  const oscuros = matriz.flat().filter(Boolean).length;
  const pintados = mockRectes.filter((rect) => rect.fill === "#16241B").length;

  expect(pintados).toBe(oscuros);
  expect(mockRectes.length).toBeGreaterThan(oscuros);
});

test("RF-302: la tarjeta del carné muestra el nombre, el grupo y la emisión", () => {
  const { getByText } = render(
    <TarjetaCarne nombres="Mateo" apellidos="Vargas" grupo="Grupo A" emision={3} codigoCarne={codigo} />
  );

  expect(getByText("Mateo Vargas")).toBeTruthy();
  expect(getByText("Grupo A")).toBeTruthy();
  expect(getByText("Emisión 3")).toBeTruthy();
  expect(getByText("SIGECAT · CARNÉ")).toBeTruthy();
});
