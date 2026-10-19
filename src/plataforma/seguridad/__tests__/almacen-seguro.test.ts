import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import {
  CLAVE_CUENTAS,
  claveSesion,
  contextoAlmacenable,
  crearAlmacenSesion,
  LIMITE_BYTES_SESION,
  type AlmacenSeguro,
  type SesionAlmacenada,
} from "../almacen-seguro";

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

const contexto: ContextoAcceso = {
  cuentaId: "cuenta-1",
  credencialId: "credencial-1",
  rolesPropios: ["catequista"],
  gruposAsignados: ["grupo-1", "grupo-2"],
  catequizandosApoderados: [],
  identidadOperativa: "Luz",
  esMenor: true,
};

function sesionDeEjemplo(extra: Partial<SesionAlmacenada> = {}): SesionAlmacenada {
  return {
    tipo: "equipo",
    cuentaId: "cuenta-1",
    credencialId: "credencial-1",
    tokenRenovacion: "token-de-renovacion",
    ultimaRenovacionServidor: 1_700_000_000_000,
    instanteMaximoVisto: 1_700_000_000_000,
    pinSal: "sal-de-16-bytes",
    pinHash: "hash",
    intentosFallidos: 0,
    bloqueada: false,
    contexto: contextoAlmacenable(contexto),
    ...extra,
  };
}

test("RF-111: dispositivoId se genera una sola vez y se reutiliza", async () => {
  const almacen = crearAlmacenSimulado();
  let generadas = 0;
  const sesion = crearAlmacenSesion({
    almacen,
    generarUuid: () => {
      generadas += 1;
      return `dispositivo-${generadas}`;
    },
  });

  const primero = await sesion.obtenerDispositivoId();
  const segundo = await sesion.obtenerDispositivoId();
  const enParalelo = await Promise.all([sesion.obtenerDispositivoId(), sesion.obtenerDispositivoId()]);

  expect(generadas).toBe(1);
  expect(segundo).toBe(primero);
  expect(enParalelo).toEqual([primero, primero]);
  expect(almacen.valores.get("sigecat.dispositivo")).toBe(primero);
});

test("RF-112: la sesión guardada no contiene nombres y pesa menos de 2 KB", async () => {
  const almacen = crearAlmacenSimulado();
  const sesion = crearAlmacenSesion({ almacen, generarUuid: () => "dispositivo-1" });

  await sesion.guardarSesion(sesionDeEjemplo());
  const bruto = almacen.valores.get(claveSesion("cuenta-1")) ?? "";

  expect(bruto).not.toContain("Luz");
  expect(bruto).not.toContain("identidadOperativa");
  expect(bruto).not.toContain("nombres");
  expect(bruto.length).toBeLessThan(LIMITE_BYTES_SESION);

  const contextoEnorme = contextoAlmacenable({
    ...contexto,
    gruposAsignados: Array.from({ length: 400 }, (_, indice) => `grupo-${indice}`),
  });

  await expect(sesion.guardarSesion(sesionDeEjemplo({ contexto: contextoEnorme }))).rejects.toThrow(
    "sesion_demasiado_grande"
  );
});

test("RNF-102: sigecat.cuentas lista las cuentas registradas en el celular", async () => {
  const almacen = crearAlmacenSimulado();
  const sesion = crearAlmacenSesion({ almacen, generarUuid: () => "dispositivo-1" });

  await sesion.registrarCuenta("cuenta-1");
  await sesion.registrarCuenta("cuenta-2");
  await sesion.registrarCuenta("cuenta-1");

  expect(await sesion.listarCuentas()).toEqual(["cuenta-1", "cuenta-2"]);
  expect(JSON.parse(almacen.valores.get(CLAVE_CUENTAS) ?? "[]")).toEqual(["cuenta-1", "cuenta-2"]);

  await sesion.guardarSesion(sesionDeEjemplo({ cuentaId: "cuenta-3" }));
  expect(await sesion.listarCuentas()).toEqual(["cuenta-1", "cuenta-2", "cuenta-3"]);
});
