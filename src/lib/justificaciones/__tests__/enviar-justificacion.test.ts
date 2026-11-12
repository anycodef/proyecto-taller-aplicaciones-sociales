import { clasificarError, enviarJustificacion, ErrorEnvio, type DependenciasEnvio, type FotoComprimida } from "../enviar-justificacion";

const foto = (bytes: number): FotoComprimida => ({ datos: new Uint8Array(bytes), bytes });
const ausencias = [
  { catequizandoId: "n1", sesionId: "s1" },
  { catequizandoId: "n1", sesionId: "s2" },
];

function dependencias(cambios: Partial<DependenciasEnvio["cliente"]> = {}) {
  const orden: string[] = [];
  let n = 0;
  const limpiar = jest.fn(async () => {
    orden.push("limpiar");
  });
  const cliente: DependenciasEnvio["cliente"] = {
    reservarEvidencia: jest.fn(async (archivos) => {
      orden.push(`reservar:${archivos.length}`);
      return { evidenciaId: "ev-1", archivos: archivos.map((_, i) => ({ orden: i + 1 })) };
    }),
    subirArchivo: jest.fn(async (_id, ordenArchivo) => {
      orden.push(`subir:${ordenArchivo}`);
      return { orden: ordenArchivo, bytes: 1 };
    }),
    crearLote: jest.fn(async (entrada) => {
      orden.push("lote");
      return { loteId: entrada.loteId, justificaciones: [] };
    }),
    ...cambios,
  };
  const deps: DependenciasEnvio = { cliente, generarId: () => `id-${++n}`, limpiar };
  return { deps, orden, cliente, limpiar };
}

test("RF-403: reserva, sube cada foto y crea el lote con una justificación por ausencia y una sola evidencia", async () => {
  const { deps, orden, cliente } = dependencias();
  const lote = await enviarJustificacion(deps, { causa: "salud_nino", fotos: [foto(100), foto(200)], ausencias });
  expect(orden).toEqual(["reservar:2", "subir:1", "subir:2", "lote", "limpiar"]);
  expect(lote.loteId).toBe("id-1");
  const entrada = (cliente.crearLote as jest.Mock).mock.calls[0][0];
  expect(entrada).toMatchObject({ causa: "salud_nino", evidenciaId: "ev-1" });
  expect(entrada.ausencias.map((a: { justificacionId: string }) => a.justificacionId)).toEqual(["id-2", "id-3"]);
});

test("RF-403: los identificadores del lote y de cada justificación nacen en el cliente", async () => {
  const { deps, cliente } = dependencias();
  await enviarJustificacion(deps, { causa: "evento_escolar", fotos: [foto(10)], ausencias });
  const entrada = (cliente.crearLote as jest.Mock).mock.calls[0][0];
  expect(new Set([entrada.loteId, ...entrada.ausencias.map((a: { justificacionId: string }) => a.justificacionId)]).size).toBe(3);
});

test("RNF-404: sin conexión falla con 'no se envió', no reintenta ni encola y limpia los temporales", async () => {
  const { deps, limpiar, cliente } = dependencias({
    reservarEvidencia: jest.fn(async () => {
      throw new TypeError("Network request failed");
    }),
  });
  const error = await enviarJustificacion(deps, { causa: "salud_nino", fotos: [foto(10)], ausencias }).catch((e) => e);
  expect(error).toBeInstanceOf(ErrorEnvio);
  expect(error.motivo).toBe("sin_red");
  expect(error.mensaje).toMatch(/^No se envió/);
  expect(cliente.reservarEvidencia).toHaveBeenCalledTimes(1);
  expect(cliente.subirArchivo).not.toHaveBeenCalled();
  expect(limpiar).toHaveBeenCalledTimes(1);
});

test("RNF-404: si falla la subida no se crea el lote y también se limpia", async () => {
  const { deps, limpiar, cliente } = dependencias({
    subirArchivo: jest.fn(async () => {
      throw new TypeError("Network request failed");
    }),
  });
  await expect(enviarJustificacion(deps, { causa: "salud_nino", fotos: [foto(10)], ausencias })).rejects.toMatchObject({ motivo: "sin_red" });
  expect(cliente.crearLote).not.toHaveBeenCalled();
  expect(limpiar).toHaveBeenCalledTimes(1);
});

test("RF-408: el servidor con el ciclo cerrado se muestra como ciclo cerrado", () => {
  expect(clasificarError(Object.assign(new Error("x"), { estado: 409, codigo: "ciclo_no_abierto" })).motivo).toBe("ciclo_cerrado");
});

test("RF-405: una ausencia ya no justificable se explica", () => {
  expect(clasificarError(Object.assign(new Error("x"), { estado: 422, codigo: "no_justificable" })).motivo).toBe("no_justificable");
  expect(clasificarError(Object.assign(new Error("x"), { estado: 403, codigo: "nino_ajeno" })).motivo).toBe("no_justificable");
});

test("RNF-402: una foto rechazada por tamaño o firma pide otra foto", () => {
  expect(clasificarError(Object.assign(new Error("x"), { estado: 400, codigo: "tamano_invalido" })).motivo).toBe("foto_invalida");
});

test("RNF-403: el límite de intentos y la sesión vencida tienen su propio aviso", () => {
  expect(clasificarError(Object.assign(new Error("x"), { estado: 429, codigo: "limite_excedido" })).motivo).toBe("limite");
  expect(clasificarError(Object.assign(new Error("x"), { estado: 401, codigo: "acceso_denegado" })).motivo).toBe("sin_acceso");
});
