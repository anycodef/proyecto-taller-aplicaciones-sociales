import { randomUUID } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import { LIMITE_BYTES, validarMetadatos } from "@/lib/justificaciones/evidencia";
import { nombreBlob, type InspeccionBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
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

test("RNF-402: la inspección detecta un blob de más de 300 KB o sin firma JPEG", async () => {
  const evidenciaId = randomUUID();
  const [grande, png, valido] = [1, 2, 3].map(orden => nombreBlob(cicloId, evidenciaId, orden));
  await contenedor.getBlockBlobClient(grande).uploadData(jpeg(LIMITE_BYTES + 1), { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
  await contenedor.getBlockBlobClient(png).uploadData(Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]), { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
  await contenedor.getBlockBlobClient(valido).uploadData(jpeg(LIMITE_BYTES), { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
  const valida = (i: InspeccionBlob | undefined) => !!i && i.firmaJpeg && validarMetadatos([i]).valida;
  const [iGrande, iPng, iValido] = await Promise.all([grande, png, valido].map(n => almacen.inspeccionar(n)));
  expect(iGrande).toEqual({ bytes: LIMITE_BYTES + 1, contentType: "image/jpeg", firmaJpeg: true });
  expect(iPng).toMatchObject({ firmaJpeg: false });
  expect([valida(iGrande), valida(iPng), valida(iValido)]).toEqual([false, false, true]);
  expect(await almacen.inspeccionar(nombreBlob(cicloId, randomUUID(), 1))).toBeUndefined();
});

test("RNF-403: la SAS de lectura solo permite r, expira en 5 min y fuerza Cache-Control no-store", async () => {
  const nombre = nombreBlob(cicloId, randomUUID(), 1);
  await contenedor.getBlockBlobClient(nombre).uploadData(jpeg(500), { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
  const ahora = new Date();
  const { url, expiraEn } = await almacen.urlLectura(nombre, ahora);
  const parametros = new URL(url).searchParams;
  expect(parametros.get("sp")).toBe("r");
  expect(parametros.get("rscc")).toBe("no-store");
  expect(Date.parse(expiraEn)).toBe(ahora.getTime() + VIGENCIA_SAS_MS);
  expect(Date.parse(parametros.get("se")!)).toBe(Math.floor((ahora.getTime() + VIGENCIA_SAS_MS) / 1000) * 1000);
  const lectura = await fetch(url);
  expect(lectura.status).toBe(200);
  expect(lectura.headers.get("cache-control")).toBe("no-store");
  expect((await subir(url, jpeg(10))).status).toBe(403);
  const { url: vencida } = await almacen.urlLectura(nombre, new Date(Date.now() - VIGENCIA_SAS_MS - 2 * 60 * 1000));
  expect((await fetch(vencida)).status).toBe(403);
});

test("RF-407: borrar elimina todos los archivos de una evidencia", async () => {
  const [evidenciaId, otraId] = [randomUUID(), randomUUID()];
  for (const orden of [1, 2, 3]) await contenedor.getBlockBlobClient(nombreBlob(cicloId, evidenciaId, orden)).uploadData(jpeg(100));
  await contenedor.getBlockBlobClient(nombreBlob(cicloId, otraId, 1)).uploadData(jpeg(100));
  expect(await almacen.borrarPrefijo(`${cicloId}/${evidenciaId}/`)).toBe(3);
  for (const orden of [1, 2, 3]) expect(await contenedor.getBlobClient(nombreBlob(cicloId, evidenciaId, orden)).exists()).toBe(false);
  expect(await contenedor.getBlobClient(nombreBlob(cicloId, otraId, 1)).exists()).toBe(true);
  await expect(almacen.borrarPrefijo(cicloId)).rejects.toThrow("prefijo_sin_barra");
  await almacen.borrar(nombreBlob(cicloId, otraId, 1));
  await expect(almacen.borrar(nombreBlob(cicloId, otraId, 1))).resolves.toBeUndefined();
  expect(await contenedor.getBlobClient(nombreBlob(cicloId, otraId, 1)).exists()).toBe(false);
});
