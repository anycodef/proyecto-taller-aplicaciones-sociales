import { randomUUID } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";

const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
const servicio = BlobServiceClient.fromConnectionString(conexion);

test("RNF-403: Azurite responde y permite crear y borrar un contenedor privado de evidencias", async () => {
  const contenedor = servicio.getContainerClient(`evidencias-${randomUUID()}`);
  await contenedor.create();
  try {
    expect((await contenedor.getProperties()).blobPublicAccess).toBeUndefined();
  } finally {
    await contenedor.delete();
  }
  expect(await contenedor.exists()).toBe(false);
});
