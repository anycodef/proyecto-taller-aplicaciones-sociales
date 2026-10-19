import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import Auditoria from "@/app/(equipo)/auditoria";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { ProveedorSesion } from "@/plataforma/seguridad/contexto-sesion";

import { crearClienteFalso } from "./soporte/cliente-falso";

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-administracion",
  credencialId: "credencial-1",
  rolesPropios: ["administracion"],
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Administración",
  esMenor: false,
};

const eventos = {
  eventos: [
    {
      id: "evento-1",
      ocurridoEn: "2026-10-19T12:00:00.000Z",
      cuentaId: "cuenta-1",
      autorVisible: "Luz",
      accion: "perfil:leer",
      recursoTipo: "catequizando",
      recursoId: "nino-1",
      catequizandoId: "nino-1",
      resultado: "permitido",
      detalle: {},
    },
  ],
};

test("RF-109: ADM consulta los eventos de un niño por fechas", async () => {
  const cliente = crearClienteFalso({ "GET /auditoria": eventos });

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <Auditoria />
    </ProveedorSesion>
  );

  fireEvent.changeText(screen.getByLabelText("Id del niño"), "nino-1");
  fireEvent.changeText(screen.getByLabelText("Desde (ISO)"), "2026-10-01T00:00:00Z");
  fireEvent.changeText(screen.getByLabelText("Hasta (ISO)"), "2026-10-31T23:59:59Z");
  fireEvent.press(screen.getByText("Consultar"));

  await waitFor(() =>
    expect(
      cliente.llamadas.some((llamada) => llamada.ruta.startsWith("/auditoria?catequizandoId=nino-1"))
    ).toBe(true)
  );

  const consulta = cliente.llamadas.find((llamada) => llamada.ruta.startsWith("/auditoria?"));
  expect(consulta?.ruta).toContain("desde=2026-10-01T00%3A00%3A00Z");
  expect(consulta?.ruta).toContain("hasta=2026-10-31T23%3A59%3A59Z");

  expect(await screen.findByText("Luz · perfil:leer")).toBeTruthy();
  expect(screen.getByText("2026-10-19 · catequizando")).toBeTruthy();
});
