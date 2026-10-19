import { fireEvent, render, screen } from "@testing-library/react-native";

import { ComponenteConsentimiento } from "@/components/seguridad/consentimiento";
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

const textoVigente = {
  id: "texto-1",
  version: "v1",
  contenido:
    "Yo, apoderado del catequizando, autorizo el tratamiento de sus datos para formar grupos y preparar los sacramentos. La constancia sacramental se conserva sin vencimiento.",
  contenidoSha256: "a".repeat(64),
  incluyeClausulaConstancia: true,
  vigenteDesde: "2026-10-19T12:00:00.000Z",
};

test("RF-106: el componente muestra el texto vigente completo y registra la aceptación", async () => {
  const cliente = crearClienteFalso({ "GET /consentimientos/texto-vigente": textoVigente });
  const aceptado: string[] = [];

  render(
    <ProveedorSesion cargar={async () => ({ tipo: "equipo", contexto })} cliente={cliente}>
      <ComponenteConsentimiento alAceptar={(texto) => aceptado.push(texto.id)} />
    </ProveedorSesion>
  );

  expect(await screen.findByText(textoVigente.contenido)).toBeTruthy();
  expect(screen.getByText("Versión v1")).toBeTruthy();
  expect(screen.getByText("Consentimiento informado")).toBeTruthy();

  fireEvent.press(screen.getByText("El apoderado acepta"));

  expect(aceptado).toEqual(["texto-1"]);
});
