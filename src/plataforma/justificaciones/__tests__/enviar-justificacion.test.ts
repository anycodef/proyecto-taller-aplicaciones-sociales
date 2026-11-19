import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { ClienteJustificaciones } from "@/lib/justificaciones/cliente-justificaciones";
import type { AusenciaRef } from "@/lib/justificaciones/tipos";
import { archivosExpo, type ArchivosTemporales, type Manipulador } from "@/plataforma/justificaciones/comprimir-foto";
import { crearBorrador, enviarJustificacion, ErrorEnvio, MENSAJE_SIN_ENVIO, subirConFetch } from "@/plataforma/justificaciones/enviar-justificacion";

jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
// Bytes de un JPEG: la subida debe mandar el contenido del archivo, no un Blob que el fetch de Expo no serializa.
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ arrayBuffer: async () => new Uint8Array(JPEG).buffer })) }));
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { fetch: jest.fn(async () => ({ isConnected: true })) } }));

let secuencia = 0;
const generarId = () => `id-${++secuencia}`;
const ausencias: AusenciaRef[] = [
  { catequizandoId: "nino-1", sesionId: "misa-1", tipoSesion: "misa", fecha: "2026-11-08" },
  { catequizandoId: "nino-2", sesionId: "misa-1", tipoSesion: "misa", fecha: "2026-11-08" },
];
const fotos = [{ uri: "file:///cache/original.jpg", ancho: 4000, alto: 3000 }];

function preparar() {
  const borradas: string[] = [];
  const manipulador: Manipulador = { dimensiones: async () => ({ ancho: 4000, alto: 3000 }), comprimir: async (_u, i) => ({ uri: `file:///cache/comprimida-${i.numero}.jpg`, ancho: i.ancho, alto: i.alto }) };
  const archivos: ArchivosTemporales = { medir: async () => 200_000, borrar: async uri => { borradas.push(uri); } };
  const cliente = {
    reservarEvidencia: jest.fn(async (evidenciaId: string) => ({ evidenciaId, expiraEn: "2026-11-10T10:05:00Z", archivos: [{ orden: 1, url: "https://blob/c/e/1.jpg?sp=c" }] })),
    crearLote: jest.fn(async (p: { loteId: string; evidenciaId: string }) => ({ loteId: p.loteId, evidenciaId: p.evidenciaId, justificaciones: [] })),
  } as unknown as ClienteJustificaciones & { reservarEvidencia: jest.Mock; crearLote: jest.Mock };
  const subir = jest.fn(async () => undefined);
  return { borradas, manipulador, archivos, cliente, subir };
}
beforeEach(() => { secuencia = 0; });

test("RF-402: reserva, sube cada foto con x-ms-blob-type BlockBlob y crea el lote", async () => {
  const d = preparar();
  const borrador = crearBorrador(generarId);
  const { lote } = await enviarJustificacion({ borrador, causa: "salud_nino", ausencias, fotos }, { ...d, subir: subirConFetch, generarId, conectado: async () => true });
  expect(d.cliente.reservarEvidencia).toHaveBeenCalledWith("id-1", [{ orden: 1, bytes: 200_000, contentType: "image/jpeg" }]);
  expect(d.cliente.crearLote).toHaveBeenCalledWith({ loteId: "id-2", evidenciaId: "id-1", causa: "salud_nino", ausencias: [
    { justificacionId: "id-3", catequizandoId: "nino-1", sesionId: "misa-1", anticipada: false },
    { justificacionId: "id-4", catequizandoId: "nino-2", sesionId: "misa-1", anticipada: false },
  ] });
  expect(lote.loteId).toBe("id-2");
  const subidas = (globalThis.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "PUT");
  expect(subidas).toEqual([["https://blob/c/e/1.jpg?sp=c", expect.objectContaining({ headers: { "x-ms-blob-type": "BlockBlob", "content-type": "image/jpeg" } })]]);
  expect(Array.from(subidas[0][1].body as Uint8Array)).toEqual(JPEG);
});

test("RF-403: un reintento manual reutiliza evidenciaId, loteId y los ids de justificación", async () => {
  const d = preparar();
  d.cliente.crearLote.mockRejectedValueOnce(Object.assign(new Error("caido"), { estado: 503, codigo: "no_disponible" }));
  const primero = await enviarJustificacion({ borrador: crearBorrador(generarId), causa: "salud_nino", ausencias, fotos }, { ...d, generarId }).catch(e => e as ErrorEnvio & { borrador: ReturnType<typeof crearBorrador> });
  expect(primero).toBeInstanceOf(ErrorEnvio);
  d.subir.mockRejectedValueOnce(new Error("ya existe"));
  const segundo = await enviarJustificacion({ borrador: primero.borrador, causa: "salud_nino", ausencias, fotos }, { ...d, generarId });
  const [primera, segunda] = d.cliente.crearLote.mock.calls.map(([p]) => p);
  expect(segunda).toEqual(primera);
  expect(segundo.borrador).toMatchObject({ evidenciaId: "id-1", loteId: "id-2", intentos: 2 });
  expect(d.cliente.reservarEvidencia.mock.calls.map(([id]) => id)).toEqual(["id-1", "id-1"]);
});

test("RNF-404: sin conexión avisa y borra los temporales sin escribir en almacenamiento", async () => {
  const d = preparar();
  const seguro = jest.spyOn(SecureStore, "setItemAsync");
  const local = (globalThis as { localStorage?: { setItem: (...a: unknown[]) => void } }).localStorage;
  const web = local ? jest.spyOn(local, "setItem") : undefined;
  const envio = enviarJustificacion({ borrador: crearBorrador(generarId), causa: "salud_nino", ausencias, fotos }, { ...d, generarId, conectado: async () => false });
  await expect(envio).rejects.toMatchObject({ codigo: "sin_conexion", mensajeVisible: MENSAJE_SIN_ENVIO });
  expect(d.borradas).toEqual(["file:///cache/original.jpg"]);
  expect(d.cliente.reservarEvidencia).not.toHaveBeenCalled();
  expect(seguro).not.toHaveBeenCalled();
  if (web) expect(web).not.toHaveBeenCalled();
});

test("RNF-404: un fallo de subida muestra el mismo aviso y no deja cola", async () => {
  const d = preparar();
  d.subir.mockRejectedValueOnce(new ErrorEnvio("subida_403", MENSAJE_SIN_ENVIO));
  await expect(enviarJustificacion({ borrador: crearBorrador(generarId), causa: "salud_nino", ausencias, fotos }, { ...d, generarId })).rejects.toMatchObject({ mensajeVisible: MENSAJE_SIN_ENVIO });
  expect(d.cliente.crearLote).not.toHaveBeenCalled();
  expect(d.borradas).toEqual(["file:///cache/original.jpg", "file:///cache/comprimida-1.jpg"]);
});

test("RNF-404: en web revoca las URL de objeto", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  const revocar = jest.fn();
  const anterior = URL.revokeObjectURL;
  URL.revokeObjectURL = revocar;
  try {
    await archivosExpo.borrar("blob:https://sigecat.app/1234");
    expect(revocar).toHaveBeenCalledWith("blob:https://sigecat.app/1234");
  } finally {
    URL.revokeObjectURL = anterior;
    Object.defineProperty(Platform, "OS", { value: original, configurable: true });
  }
});

beforeAll(() => {
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") return new Response(null, { status: 201 });
    return { blob: async () => new Blob([String(url)]) } as unknown as Response;
  }) as unknown as typeof fetch;
});
