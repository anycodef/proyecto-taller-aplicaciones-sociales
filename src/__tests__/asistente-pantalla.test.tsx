import NetInfo from "@react-native-community/netinfo";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import Asistente from "@/app/asistente";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso, type ClienteFalso } from "./soporte/cliente-falso";

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-familia",
  credencialId: "credencial-1",
  rolesPropios: ["familia"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Familia demo",
  esMenor: false,
};

const citada = {
  respuesta: "Según el material público de catequesis: el bautismo es el primer sacramento.",
  fuentes: [{ id: "bautismo", documento: "Catecismo", seccion: "Bautismo (Mateo 28:19-20)", fuente: "https://example.org", licencia: "Dominio público" }],
  proveedor: "extractivo", modelo: "extractivo-1", versionCorpus: "v1",
};
const rechazo = {
  respuesta: "No puedo consultar datos de niños, familias, salud, documentos o riesgo. Contacta a la coordinación parroquial.",
  fuentes: [], proveedor: "guardia", modelo: "filtro", versionCorpus: "v1",
};

function montar(respuestas: Record<string, unknown>): ClienteFalso {
  const cliente = crearClienteFalso(respuestas);
  render(
    <ProveedorSesion cargar={async () => ({ tipo: "familia", contexto })} cliente={cliente}>
      <Asistente />
    </ProveedorSesion>,
  );
  return cliente;
}
const preguntasEnviadas = (cliente: ClienteFalso) => cliente.llamadas.filter((l) => l.ruta === "/asistente/preguntar").map((l) => (l.cuerpo as { pregunta: string }).pregunta);

beforeEach(() => {
  jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as never);
});

async function preguntar(texto: string) {
  fireEvent.changeText(screen.getByLabelText("Tu pregunta"), texto);
  fireEvent.press(screen.getByText("Preguntar"));
}

test("RF-1001: muestra la nota fija y las tres sugerencias de arranque", async () => {
  montar({});
  expect(await screen.findByText(/Respuestas basadas en material público de catequesis\. No sustituye a la coordinación/)).toBeTruthy();
  for (const sugerencia of ["¿Qué es la confirmación?", "¿Qué es la eucaristía?", "¿Qué es el bautismo?"]) expect(screen.getByText(sugerencia)).toBeTruthy();
});

test("RF-1003: una sugerencia envía su pregunta y muestra la respuesta con «Documento · Sección» y la licencia", async () => {
  const cliente = montar({ "POST /asistente/preguntar": citada });
  fireEvent.press(await screen.findByText("¿Qué es el bautismo?"));
  expect(await screen.findByText(/el bautismo es el primer sacramento/)).toBeTruthy();
  expect(screen.getByText("Catecismo · Bautismo (Mateo 28:19-20)")).toBeTruthy();
  expect(screen.getByText("Dominio público")).toBeTruthy();
  expect(preguntasEnviadas(cliente)).toEqual(["¿Qué es el bautismo?"]);
});

test("RF-1001: se pueden hacer tres preguntas seguidas y quedan en el historial de la pantalla", async () => {
  const cliente = montar({ "POST /asistente/preguntar": citada });
  await screen.findByText("Tu pregunta");
  for (const pregunta of ["¿Qué es la confirmación?", "¿Qué es la eucaristía?", "¿Qué es el bautismo?"]) {
    await preguntar(pregunta);
    await waitFor(() => expect(preguntasEnviadas(cliente)).toContain(pregunta));
    await waitFor(() => expect(screen.getAllByText(/el bautismo es el primer sacramento/).length).toBe(preguntasEnviadas(cliente).length));
  }
  expect(preguntasEnviadas(cliente)).toHaveLength(3);
  expect(screen.getAllByText("Catecismo · Bautismo (Mateo 28:19-20)")).toHaveLength(3);
});

test("RF-1004: una pregunta sobre una persona concreta se muestra como rechazo informativo, no como doctrina", async () => {
  montar({ "POST /asistente/preguntar": rechazo });
  await screen.findByText("Tu pregunta");
  await preguntar("¿Cuántas faltas tiene Juan?");
  expect(await screen.findByText(/No puedo consultar datos de niños, familias, salud/)).toBeTruthy();
  expect(screen.queryByText(/Dominio público/)).toBeNull();
});

test("RF-1003: la abstención por falta de sustento no se presenta como respuesta doctrinal", async () => {
  montar({ "POST /asistente/preguntar": { respuesta: "No encontré sustento suficiente en el material público para responder esa pregunta.", fuentes: [], proveedor: "extractivo", modelo: "abstencion", versionCorpus: "v1" } });
  await screen.findByText("Tu pregunta");
  await preguntar("¿Quién ganó el mundial?");
  expect(await screen.findByText(/No encontré sustento suficiente/)).toBeTruthy();
});

test("RNF-1004: una pregunta vacía o de menos de 3 caracteres no se envía", async () => {
  const cliente = montar({ "POST /asistente/preguntar": citada });
  await screen.findByText("Tu pregunta");
  fireEvent.changeText(screen.getByLabelText("Tu pregunta"), "  ab ");
  expect(screen.getByRole("button", { name: "Preguntar" }).props.accessibilityState?.disabled).toBe(true);
  fireEvent.press(screen.getByText("Preguntar"));
  expect(preguntasEnviadas(cliente)).toEqual([]);
});

test("RNF-1001: un error de red muestra «No pudimos consultar el servidor» y no pierde la pregunta", async () => {
  montar({ "POST /asistente/preguntar": new TypeError("Network request failed") });
  await screen.findByText("Tu pregunta");
  await preguntar("¿Qué es la eucaristía?");
  expect(await screen.findByText("No pudimos consultar el servidor")).toBeTruthy();
  expect(screen.getByLabelText("Tu pregunta").props.value).toBe("¿Qué es la eucaristía?");
});

test("RF-1005: al llegar al límite de 20 preguntas por hora avisa con el mensaje claro", async () => {
  montar({ "POST /asistente/preguntar": Object.assign(new Error("limite_excedido"), { estado: 429, codigo: "limite_excedido" }) });
  await screen.findByText("Tu pregunta");
  await preguntar("¿Qué es la eucaristía?");
  expect(await screen.findByText("Llegaste al límite de preguntas por hora; intenta más tarde.")).toBeTruthy();
});

test("RNF-1001: muestra el aviso de no escribir datos de niños", async () => {
  montar({});
  expect(await screen.findByText(/No escribas nombres, documentos, datos de salud/)).toBeTruthy();
});

test("RNF-1001: sin conexión bloquea el envío y avisa que el asistente necesita red", async () => {
  jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: false } as never);
  const cliente = montar({ "POST /asistente/preguntar": citada });
  expect(await screen.findByText(/El asistente necesita conexión/)).toBeTruthy();
  await preguntar("¿Qué es la eucaristía?");
  expect(preguntasEnviadas(cliente)).toEqual([]);
});
