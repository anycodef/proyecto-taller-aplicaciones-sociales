import { randomUUID } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import { AzureBorradorBlobs } from "../../../src/modulos/seguridad/aplicacion/motor-retencion";

test("RF-106 RF-108: borrador Azure elimina blob privado de Azurite y repetir borrado es idempotente", async () => {
  const anterior = process.env.BLOBS_CONEXION;
  const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
  process.env.BLOBS_CONEXION = conexion;
  const servicio = BlobServiceClient.fromConnectionString(conexion);
  const contenedor = servicio.getContainerClient(`prueba-${randomUUID()}`);
  try {
    await contenedor.create();
    const blob = contenedor.getBlockBlobClient("evidencia-ficticia.txt");
    await blob.upload("evidencia ficticia", Buffer.byteLength("evidencia ficticia"));
    expect(await blob.exists()).toBe(true);
    const borrador = new AzureBorradorBlobs();
    await borrador.borrar({ contenedor: contenedor.containerName, ruta: blob.name });
    expect(await blob.exists()).toBe(false);
    await expect(borrador.borrar({ contenedor: contenedor.containerName, ruta: blob.name })).resolves.toBeUndefined();
  } finally {
    await contenedor.deleteIfExists();
    if (anterior === undefined) delete process.env.BLOBS_CONEXION; else process.env.BLOBS_CONEXION = anterior;
  }
}, 30000);
