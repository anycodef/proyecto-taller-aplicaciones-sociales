import { randomUUID } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import { nombreBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { crearAlmacenEvidencias, VIGENCIA_SAS_MS } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";

const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
const servicio = BlobServiceClient.fromConnectionString(conexion);
const contenedor = servicio.getContainerClient(`evidencias-${randomUUID()}`);
const almacen = crearAlmacenEvidencias({ modo: "pruebas", conexion, contenedor: contenedor.containerName });
const cicloId = randomUUID();
const jpeg = (bytes: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(Math.max(0, bytes - 4), 1)]);
const subir = (url: string, cuerpo: Buffer) => fetch(url, { method: "PUT", body: new Uint8Array(cuerpo), headers: { "x-ms-blob-type": "BlockBlob", "content-type": "image/jpeg" } });

beforeAll(async () => { await contenedor.create(); });
afterAll(async () => { await contenedor.deleteIfExists(); });

test("RNF-403: Azurite responde y permite crear y borrar un contenedor privado de evidencias", async () => {
  const otro = servicio.getContainerClient(`evidencias-${randomUUID()}`);
  await otro.create();
  try {
    expect((await otro.getProperties()).blobPublicAccess).toBeUndefined();
  } finally {
    await otro.delete();
  }
  expect(await otro.exists()).toBe(false);
});

test("RNF-403: el blob se nombra {cicloId}/{evidenciaId}/{orden}.jpg", async () => {
  const evidenciaId = randomUUID();
  const nombre = nombreBlob(cicloId, evidenciaId, 2);
  expect(nombre).toBe(`${cicloId}/${evidenciaId}/2.jpg`);
  const { url, expiraEn } = await almacen.urlSubida(nombre, new Date());
  expect(new URL(url).pathname).toBe(`/devstoreaccount1/${contenedor.containerName}/${cicloId}/${evidenciaId}/2.jpg`);
  expect(Date.parse(expiraEn) - Date.now()).toBeLessThanOrEqual(VIGENCIA_SAS_MS);
  expect((await subir(url, jpeg(1000))).status).toBe(201);
  expect(await contenedor.getBlobClient(nombre).exists()).toBe(true);
});

test("RNF-403: la SAS de subida no permite sobrescribir", async () => {
  const nombre = nombreBlob(cicloId, randomUUID(), 1);
  const { url } = await almacen.urlSubida(nombre, new Date());
  expect(new URL(url).searchParams.get("sp")).toBe("c");
  expect((await subir(url, jpeg(1000))).status).toBe(201);
  const segunda = await subir(url, jpeg(2000));
  expect(segunda.ok).toBe(false);
  expect((await contenedor.getBlobClient(nombre).getProperties()).contentLength).toBe(1000);
});

test("RNF-403: la SAS vencida es rechazada", async () => {
  const nombre = nombreBlob(cicloId, randomUUID(), 1);
  const { url } = await almacen.urlSubida(nombre, new Date(Date.now() - VIGENCIA_SAS_MS - 2 * 60 * 1000));
  expect((await subir(url, jpeg(1000))).status).toBe(403);
  expect(await contenedor.getBlobClient(nombre).exists()).toBe(false);
});
