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

const DIA = 86_400_000;

function crearClienteFalso(peticiones: Peticion[], sinRed: boolean): ClienteHttp {
  return {
    solicitar: async <T>(metodo: string, ruta: string, cuerpo?: unknown) => {
      peticiones.push({ metodo, ruta, cuerpo });
      if (ruta === "/acceso/bloqueo") {
        if (sinRed) throw new Error("sin_red");
        return { bloqueada: true } as T;
      }
      return respuestaServidor as T;
    },
  };
}

function preparar(opciones: { sinRed?: boolean } = {}) {
  const almacenSeguro = crearAlmacenSimulado();
  const almacen = crearAlmacenSesion({ almacen: almacenSeguro, generarUuid: () => "dispositivo-1" });
  const peticiones: Peticion[] = [];
  const reloj = { ahora: Date.parse("2026-10-19T12:00:00.000Z") };
  const gestor = crearGestorSesion({
    almacen,
    cliente: crearClienteFalso(peticiones, opciones.sinRed ?? false),
    generarSal: () => "sal-de-16-bytes",
    calcularHash: async (valor) => `hash(${valor})`,
    ahora: () => reloj.ahora,
  });
  return { almacen, almacenSeguro, gestor, peticiones, reloj };
}

async function conSesionFijada(kit: ReturnType<typeof preparar>) {
  const activacion = await kit.gestor.activarEquipo("token-del-enlace");
  await kit.gestor.fijarPin(activacion, "1234");
  return activacion;
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

test("RF-111: con 5 fallos seguidos el celular queda bloqueado y borra el token", async () => {
  const kit = preparar({ sinRed: true });
  await conSesionFijada(kit);

  for (let intento = 1; intento <= 4; intento += 1) {
    const resultado = await kit.gestor.desbloquear("cuenta-1", "9999");
    expect(resultado.estado).toBe("pin_invalido");
    expect(resultado.intentosFallidos).toBe(intento);
  }

  const quinto = await kit.gestor.desbloquear("cuenta-1", "9999");

  expect(quinto.estado).toBe("bloqueada");
  expect(quinto.intentosFallidos).toBe(5);
  expect(quinto.bloqueoReportado).toBe(false);

  const guardada = await kit.almacen.leerSesion("cuenta-1");
  expect(guardada?.bloqueada).toBe(true);
  expect(guardada?.tokenRenovacion).toBeUndefined();
  expect(guardada?.pinHash).toBeUndefined();

  const bruto = kit.almacenSeguro.valores.get("sigecat.sesion.cuenta-1") ?? "";
  expect(bruto).not.toContain("token-de-renovacion");
  expect(bruto).not.toContain("hash(");
});

test("RF-111: al bloquear con red se reporta el bloqueo al servidor", async () => {
  const kit = preparar();
  await conSesionFijada(kit);

  for (let intento = 0; intento < 5; intento += 1) {
    await kit.gestor.desbloquear("cuenta-1", "9999");
  }

  const bloqueo = kit.peticiones.find((peticion) => peticion.ruta === "/acceso/bloqueo");
  expect(bloqueo).toEqual({
    metodo: "POST",
    ruta: "/acceso/bloqueo",
    cuerpo: { tokenRenovacion: "token-de-renovacion", dispositivoId: "dispositivo-1" },
  });

  const resultado = await kit.gestor.desbloquear("cuenta-1", "9999");
  expect(resultado.estado).toBe("bloqueada");
});

test("RF-112: el PIN desbloquea sin conexión si no pasaron 14 días desde la última renovación", async () => {
  const kit = preparar({ sinRed: true });
  await conSesionFijada(kit);

  const ultimaRenovacion = kit.reloj.ahora;

  kit.reloj.ahora = ultimaRenovacion + 13 * DIA;
  const diaTrece = await kit.gestor.desbloquear("cuenta-1", "1234");
  expect(diaTrece.estado).toBe("operativa");
  expect(kit.peticiones.filter((peticion) => peticion.ruta !== "/acceso/equipo/activar")).toHaveLength(0);

  kit.reloj.ahora = ultimaRenovacion + 15 * DIA;
  const diaQuince = await kit.gestor.desbloquear("cuenta-1", "1234");
  expect(diaQuince.estado).toBe("requiere-conexion");
});
