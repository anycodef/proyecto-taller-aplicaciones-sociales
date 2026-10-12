import { app } from "@azure/functions";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { autorizar } from "@/lib/seguridad/autorizacion";
import { conAcceso } from "../../../src/compartido/http/con-acceso";
import { registrarCatequizandos } from "../../../src/modulos/catequizandos/http";
import { registrarInscripciones } from "../../../src/modulos/inscripciones/http";
jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../../../src/compartido/http/con-acceso", () => ({ conAcceso: jest.fn((opciones, handler) => Object.assign(handler, { opciones })) }));
type Opciones = { accion: string; recurso?: unknown };
const ctx = (...roles: Rol[]): ContextoAcceso => ({ cuentaId: "cuenta", credencialId: "credencial", identidadOperativa: "Luz", rolesPropios: roles, esMenor: true, gruposAsignados: ["grupo"], catequizandosApoderados: ["nino"] });
test("RF-201 RF-202 RF-203 RF-204 RF-205 RF-206 RF-207 RF-302: las 24 rutas del plan registran middleware y acción acordada", () => {
  registrarCatequizandos(); registrarInscripciones();
  const llamadas = jest.mocked(app.http).mock.calls;
  expect(llamadas).toHaveLength(24);
  const rutas = llamadas.map(([, configuracion]) => `${configuracion.methods?.[0]} /${configuracion.route}`);
  expect(new Set(rutas).size).toBe(24);
  for (const [, configuracion] of llamadas) {
    expect(configuracion.authLevel).toBe("function");
    const opciones = (configuracion.handler as unknown as { opciones: Opciones }).opciones;
    expect(opciones.accion).toBeTruthy();
    if (configuracion.methods?.[0] !== "GET") {
      expect(autorizar(ctx("coordinacion"), opciones.accion, { grupoId: "grupo", catequizandoId: "nino" }).permitido).toBe(true);
      for (const rol of ["familia", "catequista", "supervision"] as Rol[]) expect(autorizar(ctx(rol), opciones.accion, { grupoId: "grupo", catequizandoId: "nino" }).permitido).toBe(false);
      const delegado = { ...ctx("catequista"), delegacionVigente: { id: "delegacion", hasta: "2027-01-01" } };
      expect(autorizar(delegado, opciones.accion).permitido).toBe(true);
    }
    if (configuracion.route?.includes("{id}") && !configuracion.route.includes("ciclos/")) expect(opciones.recurso).toBeDefined();
  }
  expect(jest.mocked(conAcceso).getMockImplementation()).toBeDefined();
  expect(rutas).toEqual(expect.arrayContaining(["POST /inscripciones", "POST /inscripciones/duplicados/confirmar", "PUT /inscripciones/{id}/grupo", "GET /ciclos/{cicloId}/documentos-pendientes", "GET /grupos/{id}/carnes", "POST /catequizandos/{id}/carne/reemitir"]));
});
test("RF-201 RF-204 RF-205: permisos de lectura unen alcances sin exponer condiciones a familia", () => {
  const propio = { grupoId: "grupo", catequizandoId: "nino" }, ajeno = { grupoId: "otro", catequizandoId: "otro" };
  for (const accion of ["perfil:leer", "documento:leer"]) {
    expect(autorizar(ctx("familia"), accion, propio).permitido).toBe(true);
    expect(autorizar(ctx("familia"), accion, ajeno).permitido).toBe(false);
    expect(autorizar(ctx("catequista"), accion, propio).permitido).toBe(true);
    expect(autorizar(ctx("catequista"), accion, ajeno).permitido).toBe(false);
    expect(autorizar(ctx("supervision"), accion, propio).permitido).toBe(false);
  }
  expect(autorizar(ctx("familia"), "restringido:leer", propio).permitido).toBe(false);
  expect(autorizar(ctx("catequista"), "restringido:leer", propio).permitido).toBe(true);
  expect(autorizar(ctx("catequista"), "restringido:leer", ajeno).permitido).toBe(false);
});
