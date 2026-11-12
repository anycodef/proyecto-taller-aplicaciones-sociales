import { fireEvent, render, screen } from "@testing-library/react-native";

import { SelectorAusencias } from "@/components/justificaciones/selector-ausencias";
import { SelectorCausa } from "@/components/justificaciones/selector-causa";
import { CAUSAS, ETIQUETAS_CAUSA } from "@/lib/justificaciones/causas";

test("RF-402: el selector muestra solo las tres causas como chips", () => {
  const alCambiar = jest.fn();
  render(<SelectorCausa causas={CAUSAS.map((c) => ({ valor: c, etiqueta: ETIQUETAS_CAUSA[c] }))} valor={null} alCambiar={alCambiar} />);
  const chips = screen.getAllByRole("radio");
  expect(chips).toHaveLength(3);
  expect(screen.getByText("Salud del niño")).toBeTruthy();
  expect(screen.getByText("Enfermedad o fallecimiento de un familiar directo")).toBeTruthy();
  expect(screen.queryByText(/viaje/i)).toBeNull();
  fireEvent.press(screen.getByText("Evento escolar comunicado con anticipación"));
  expect(alCambiar).toHaveBeenCalledWith("evento_escolar");
});

test("RF-403: el selector permite marcar ausencias de varios hijos y fechas", () => {
  const alCambiar = jest.fn();
  const opciones = [
    { clave: "ana-01", titulo: "Ana · 1 de noviembre", detalle: "Misa" },
    { clave: "ana-08", titulo: "Ana · 8 de noviembre", detalle: "Misa" },
    { clave: "luis-08", titulo: "Luis · 8 de noviembre", detalle: "Misa" },
  ];
  const { rerender } = render(<SelectorAusencias opciones={opciones} seleccionadas={["ana-01"]} alCambiar={alCambiar} />);
  fireEvent.press(screen.getByText("Luis · 8 de noviembre"));
  expect(alCambiar).toHaveBeenLastCalledWith(["ana-01", "luis-08"]);
  rerender(<SelectorAusencias opciones={opciones} seleccionadas={["ana-01", "luis-08"]} alCambiar={alCambiar} />);
  expect(screen.getAllByRole("checkbox").map((c) => c.props.accessibilityState.checked)).toEqual([true, false, true]);
  fireEvent.press(screen.getByText("Ana · 1 de noviembre"));
  expect(alCambiar).toHaveBeenLastCalledWith(["luis-08"]);
});
