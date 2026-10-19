import type { ClienteHttp } from "@/plataforma/api/cliente";
import { crearAlmacenSesion, type AlmacenSeguro } from "@/plataforma/seguridad/almacen-seguro";

import { crearGestorSesion, type RespuestaActivacionServidor } from "../sesion";

type Peticion = { metodo: string; ruta: string; cuerpo?: unknown };

function crearAlmacenSimulado(): AlmacenSeguro & { valores: Map<string, string> } {
  const valores = new Map<string, string>();
  return {
    valores,
    leer: async (clave) => valores.get(clave) ?? null,
    escribir: async (clave, valor) => {
      valores.set(clave, valor);
    },
    borrar: async (clave) => {
      valores.delete(clave);
    },
  };
}

const respuestaServidor: RespuestaActivacionServidor = {
  jwt: "jwt-de-equipo",
  tokenRenovacion: "token-de-renovacion",
  ultimaRenovacion: "2026-10-19T12:00:00.000Z",
  contexto: {
    cuentaId: "cuenta-1",
    credencialId: "credencial-1",
    rolesPropios: ["catequista"],
    gruposAsignados: ["grupo-1"],
    catequizandosApoderados: [],
    identidadOperativa: "Luz",
    esMenor: true,
  },
};

function crearClienteFalso(peticiones: Peticion[]): ClienteHttp {
  return {
    solicitar: async <T>(metodo: string, ruta: string, cuerpo?: unknown) => {
      peticiones.push({ metodo, ruta, cuerpo });
      return respuestaServidor as T;
    },
  };
}

function preparar() {
  const almacenSeguro = crearAlmacenSimulado();
  const almacen = crearAlmacenSesion({ almacen: almacenSeguro, generarUuid: () => "dispositivo-1" });
  const peticiones: Peticion[] = [];
  const gestor = crearGestorSesion({
    almacen,
    cliente: crearClienteFalso(peticiones),
    generarSal: () => "sal-de-16-bytes",
    calcularHash: async (valor) => `hash(${valor})`,
    ahora: () => 1_700_000_000_000,
  });
  return { almacen, almacenSeguro, gestor, peticiones };
}

test("RF-111: la credencial se guarda en SecureStore solo después de fijar el PIN", async () => {
  const { almacen, gestor } = preparar();

  const activacion = await gestor.activarEquipo("token-del-enlace");

  expect(activacion.credencialId).toBe("credencial-1");
  expect(await almacen.leerSesion("cuenta-1")).toBeNull();

  const sesion = await gestor.fijarPin(activacion, "1234");

  const guardada = await almacen.leerSesion("cuenta-1");
  expect(guardada?.pinSal).toBe("sal-de-16-bytes");
  expect(guardada?.pinHash).toBe("hash(sal-de-16-bytes:1234)");
  expect(guardada?.tokenRenovacion).toBe("token-de-renovacion");
  expect(guardada?.bloqueada).toBe(false);
  expect(sesion.contexto.rolesPropios).toEqual(["catequista"]);
});

test("RF-111: el PIN nunca se envía al servidor", async () => {
  const { gestor, peticiones } = preparar();

  const activacion = await gestor.activarEquipo("token-del-enlace");
  await gestor.fijarPin(activacion, "1234");

  const enviados = JSON.stringify(peticiones);
  expect(enviados).not.toContain("1234");
  expect(enviados).not.toContain("sal-de-16-bytes");
  expect(enviados).not.toContain("hash(");
  expect(peticiones[0]).toEqual({
    metodo: "POST",
    ruta: "/acceso/equipo/activar",
    cuerpo: { token: "token-del-enlace", dispositivoId: "dispositivo-1" },
  });
});
