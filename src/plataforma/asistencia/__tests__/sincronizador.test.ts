import { crearMarca, guardarMarca, PENDIENTES_VACIOS } from "@/lib/asistencia/pendientes";
import { aplicarPull, almacenVacio } from "@/lib/sincronizacion/almacen-local";
import { ninosDelGrupo, sincronizar } from "@/plataforma/asistencia/sincronizador";

const sesionId = "11111111-1111-4111-8111-111111111111";

function clienteFalso(respuestas: Record<string, unknown>) {
  const llamadas: { metodo: string; ruta: string; cuerpo?: unknown }[] = [];
  return {
    llamadas,
    solicitar: async <T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> => {
      llamadas.push({ metodo, ruta, cuerpo });
      const clave = `${metodo} ${ruta}`;
      if (!(clave in respuestas)) throw new Error(`sin respuesta para ${clave}`);
      const respuesta = respuestas[clave];
      if (respuesta instanceof Error) throw respuesta;
      return respuesta as T;
    },
  };
}

const nomina = {
  changes: {
    catequizandos: {
      created: [
        { id: "nino-1", nombres: "Mateo", apellidos: "Vargas", grupo_id: "grupo-1", codigo_carne: "SGC1:nino-1:1", activo: true },
        { id: "nino-2", nombres: "Ana", apellidos: "Pérez", grupo_id: "grupo-1", codigo_carne: "SGC1:nino-2:1", activo: true },
      ],
      updated: [],
      deleted: [],
    },
  },
  timestamp: 1_700_000_000_000,
  huellaAlcance: "huella-1",
};

function marcaDePrueba() {
  return crearMarca({
    sesionId,
    cicloId: "ciclo-1",
    catequizandoId: "nino-1",
    valor: "presente",
    tipoRegistro: "manual",
    listaId: null,
    registradoPor: "cuenta-1",
    cuentaId: "cuenta-1",
    credencialId: "credencial-1",
    dispositivoId: "dispositivo-1",
    horaDispositivo: "2026-10-19T09:00:00.000Z",
    desfaseRelojMs: 0,
  });
}

test("RF-307: la sincronizacion baja la nomina y devuelve el estado con ella", async () => {
  const cliente = clienteFalso({ "GET /sincronizacion/cambios": nomina });

  const { estado, resultado } = await sincronizar({
    almacen: almacenVacio(),
    cliente,
  });

  expect(resultado.nominaActualizada).toBe(true);
  expect(ninosDelGrupo(estado, "grupo-1")).toHaveLength(2);
  expect(estado.ultimoPulso).toBe(1_700_000_000_000);
});

test("RF-307: sin red la nomina no se pisa y las marcas siguen pendientes", async () => {
  const cliente = clienteFalso({ "GET /sincronizacion/cambios": new Error("Network request failed") });
  const almacen = aplicarPull(almacenVacio(), nomina);
  const conMarca = {
    ...almacen,
    pendientes: guardarMarca(PENDIENTES_VACIOS, marcaDePrueba()),
  };

  const { resultado } = await sincronizar({ almacen: conMarca, cliente, pulling: false });

  expect(resultado.pendientes).toBe(1);
  expect(resultado.nominaActualizada).toBe(false);
});

test("RF-307: el push envia cada marca una sola vez y no duplica al reintentar", async () => {
  const cliente = clienteFalso({
    "POST /sincronizacion/cambios": { aceptados: 1, rechazados: 0, descartadosCierre: 0 },
  });

  const marca = marcaDePrueba();
  const almacen = { ...almacenVacio(), pendientes: guardarMarca(PENDIENTES_VACIOS, marca) };

  const { estado, resultado } = await sincronizar({ almacen, cliente, pulling: false });

  const push = cliente.llamadas.find((llamada) => llamada.metodo === "POST");
  const cuerpo = push?.cuerpo as { changes: { marcas_asistencia: { created: unknown[] } } };
  expect(cuerpo.changes.marcas_asistencia.created).toHaveLength(1);
  expect(resultado.aceptados).toBe(1);
  expect(resultado.pendientes).toBe(0);
  expect(estado.pendientes.marcas).toHaveLength(0);
  expect(resultado.idsEnviados).toEqual([marca.id]);
});

test("RF-307: si el servidor rechaza algo, la marca se conserva para el siguiente intento", async () => {
  const cliente = clienteFalso({
    "POST /sincronizacion/cambios": { aceptados: 0, rechazados: 1, descartadosCierre: 0 },
  });

  const almacen = { ...almacenVacio(), pendientes: guardarMarca(PENDIENTES_VACIOS, marcaDePrueba()) };

  const { estado, resultado } = await sincronizar({ almacen, cliente, pulling: false });

  expect(resultado.rechazados).toBe(1);
  expect(resultado.pendientes).toBe(1);
  expect(estado.pendientes.marcas).toHaveLength(1);
});
