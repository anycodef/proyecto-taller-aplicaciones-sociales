import { fireEvent, render, screen } from "@testing-library/react-native";

import Riesgo from "@/app/(equipo)/riesgo";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-coordinacion",
  credencialId: "credencial-1",
  rolesPropios: ["coordinacion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Coordinación demo",
  esMenor: false,
};

const falta = (fecha: string, estado = "suma") => ({ catequizandoId: "x", fecha, origen: "domingo", estado, sesionIds: ["s"] });
const lista = [
  { catequizandoId: "n2", nombre: "Niño ficticio 2", grupoId: "g", grupoNombre: "Grupo demo", paso: "alerta_retiro", conteo: 4, sinFicha: true, pendientesJustificar: 0,
    faltasOrigen: [falta("2026-10-18"), falta("2026-10-25"), falta("2026-11-01"), falta("2026-11-08")] },
  { catequizandoId: "n3", nombre: "Niño ficticio 3", grupoId: "g", grupoNombre: "Grupo demo", paso: "citacion", conteo: 3, sinFicha: true, pendientesJustificar: 0,
    faltasOrigen: [falta("2026-10-18"), falta("2026-10-25"), falta("2026-11-01")] },
  { catequizandoId: "n1", nombre: "Niño ficticio 1", grupoId: "g", grupoNombre: "Grupo demo", paso: "contacto", conteo: 2, sinFicha: true, pendientesJustificar: 1,
    faltasOrigen: [falta("2026-10-18"), falta("2026-10-25"), falta("2026-11-08", "pendiente_justificar")] },
];

function montar(respuestas: Record<string, unknown>) {
  const cliente = crearClienteFalso(respuestas);
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <Riesgo />
    </ProveedorSesion>,
  );
  return cliente;
}

test("RF-707: muestra los niños agrupados por paso con su explicación y el total", async () => {
  montar({ "GET /riesgo": lista });
  expect(await screen.findByText("3 niños en riesgo")).toBeTruthy();
  expect(screen.getByText("Alerta de retiro (1)")).toBeTruthy();
  expect(screen.getByText("Citación (1)")).toBeTruthy();
  expect(screen.getByText("Contacto (1)")).toBeTruthy();
  expect(screen.getByText("4 faltas sin justificar (18 oct, 25 oct, 1 nov, 8 nov) y sin ficha de compromiso firmada")).toBeTruthy();
  expect(screen.getByText("3 faltas (18 oct, 25 oct, 1 nov) y sin ficha de compromiso firmada")).toBeTruthy();
});

test("RF-701: la falta pendiente de justificar se ve como pendiente y no como suma", async () => {
  montar({ "GET /riesgo": lista });
  expect(await screen.findByText("1 falta pendiente de justificar: aún no suma")).toBeTruthy();
  expect(screen.getByText("8 nov · pendiente de justificar")).toBeTruthy();
});

test("RNF-702: el orden es alerta de retiro, citación y contacto", async () => {
  montar({ "GET /riesgo": lista });
  await screen.findByText("3 niños en riesgo");
  const titulos = screen.getAllByText(/\(1\)$/).map((nodo) => nodo.props.children.join(""));
  expect(titulos).toEqual(["Alerta de retiro (1)", "Citación (1)", "Contacto (1)"]);
});

test("RF-707: sin nadie en riesgo dice que nadie está en riesgo hoy", async () => {
  montar({ "GET /riesgo": [] });
  expect(await screen.findAllByText("Nadie está en riesgo hoy")).not.toHaveLength(0);
});

test("RF-707: nunca muestra salud ni documentos del niño", async () => {
  montar({ "GET /riesgo": lista });
  await screen.findByText("3 niños en riesgo");
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/salud|documento|neurodivergen/i);
});

test("RNF-704: sin red muestra el error y permite reintentar", async () => {
  const cliente = montar({ "GET /riesgo": new Error("sin red") });
  expect(await screen.findByText("No pudimos consultar el servidor. Revisa tu conexión.")).toBeTruthy();
  fireEvent.press(screen.getByText("Reintentar"));
  expect(await screen.findAllByText("No pudimos consultar el servidor. Revisa tu conexión.")).not.toHaveLength(0);
  expect(cliente.llamadas.filter((l) => l.ruta === "/riesgo").length).toBeGreaterThanOrEqual(2);
});
