import { alReconectar } from "@/lib/seguridad/reconexion";
import type { ClienteHttp } from "@/plataforma/api/cliente";
import { crearAlmacenSesion, type AlmacenSeguro } from "@/plataforma/seguridad/almacen-seguro";
import { crearGestorSesion } from "@/plataforma/seguridad/sesion";

const DIA = 86_400_000;

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

const contexto = {
  cuentaId: "cuenta-1",
  credencialId: "credencial-1",
  rolesPropios: ["catequista"] as const,
  gruposAsignados: [],
  catequizandosApoderados: [],
  identidadOperativa: "Luz",
  esMenor: true,
};

function crearServidorFalso(llamadas: string[]) {
  return {
    solicitar: async <T,>(metodo: string, ruta: string): Promise<T> => {
      llamadas.push(`${metodo} ${ruta}`);
      if (ruta === "/acceso/equipo/activar") {
        return {
          jwt: "jwt-1",
          tokenRenovacion: "token-de-renovacion",
          ultimaRenovacion: "2026-10-19T12:00:00.000Z",
          contexto,
        } as T;
      }
      if (ruta === "/acceso/renovar") {
        return {
          jwt: "jwt-2",
          tokenRenovacion: "token-de-renovacion-2",
          ultimaRenovacion: "2026-10-19T12:00:00.000Z",
          contexto,
        } as T;
      }
      return {} as T;
    },
  } as ClienteHttp;
}

test("RF-112: flujo de sesión del celular de extremo a extremo", async () => {
  const almacenSeguro = crearAlmacenSimulado();
  const almacen = crearAlmacenSesion({ almacen: almacenSeguro, generarUuid: () => "dispositivo-1" });
  const llamadas: string[] = [];
  const reloj = { ahora: Date.parse("2026-10-19T12:00:00.000Z") };

  const gestor = crearGestorSesion({
    almacen,
    cliente: crearServidorFalso(llamadas),
    generarSal: () => "sal-de-16-bytes",
    calcularHash: async (valor) => `hash(${valor})`,
    ahora: () => reloj.ahora,
  });

  // 1. Activar el enlace y fijar el PIN.
  const activacion = await gestor.activarEquipo("token-del-enlace");
  expect(activacion.credencialId).toBe("credencial-1");
  expect(await almacen.leerSesion("cuenta-1")).toBeNull();

  await gestor.fijarPin(activacion, "1234");
  const fijada = await almacen.leerSesion("cuenta-1");
  expect(fijada?.pinHash).toBe("hash(sal-de-16-bytes:1234)");
  expect(fijada?.tokenRenovacion).toBe("token-de-renovacion");

  // 2. Desbloquear sin red el dia 13 y el dia 15.
  reloj.ahora += 13 * DIA;
  const diaTrece = await gestor.desbloquear("cuenta-1", "1234");
  expect(diaTrece.estado).toBe("operativa");

  reloj.ahora += 2 * DIA;
  const diaQuince = await gestor.desbloquear("cuenta-1", "1234");
  expect(diaQuince.estado).toBe("requiere-conexion");

  // 3. Cinco PIN incorrectos bloquean el celular y borran el token.
  reloj.ahora = Date.parse("2026-10-19T12:00:00.000Z");
  for (let intento = 0; intento < 5; intento += 1) {
    await gestor.desbloquear("cuenta-1", "9999");
  }
  const bloqueada = await almacen.leerSesion("cuenta-1");
  expect(bloqueada?.bloqueada).toBe(true);
  expect(bloqueada?.tokenRenovacion).toBeUndefined();
  expect(almacenSeguro.valores.get("sigecat.sesion.cuenta-1")).not.toContain("token-de-renovacion");

  // 5. Al reconectar, la renovacion ocurre antes del push.
  const orden: string[] = [];
  const resultado = await alReconectar({
    renovar: async (pendientes) => {
      orden.push(`renovar:${pendientes}`);
      return "ok";
    },
    contarPendientes: async () => 3,
    enviarPendientes: async () => {
      orden.push("enviar");
    },
    descartarPendientes: async () => {
      orden.push("descartar");
    },
  });

  expect(orden).toEqual(["renovar:3", "enviar"]);
  expect(resultado.rechazados).toBe(0);
});
