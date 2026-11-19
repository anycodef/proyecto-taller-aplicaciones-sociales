import { render, screen } from "@testing-library/react-native";

import JustificacionEnviada from "@/app/(familia)/familia/enviada";

jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useLocalSearchParams: () => ({ resumen: JSON.stringify(["Ana · domingo 8 de noviembre · Misa", "Luis · domingo 8 de noviembre · Misa"]) }),
}));

test("RF-402: confirma la recepción con la lista de ausencias justificadas", () => {
  render(<JustificacionEnviada />);
  expect(screen.getByText("Justificación recibida")).toBeTruthy();
  expect(screen.getByText("• Ana · domingo 8 de noviembre · Misa")).toBeTruthy();
  expect(screen.getByText("• Luis · domingo 8 de noviembre · Misa")).toBeTruthy();
});
