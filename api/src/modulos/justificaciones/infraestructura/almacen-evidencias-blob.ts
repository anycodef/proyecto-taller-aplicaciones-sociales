import {
  BlobSASPermissions, BlobServiceClient, SASProtocol, StorageSharedKeyCredential, generateBlobSASQueryParameters, type BlobSASSignatureValues,
} from "@azure/storage-blob";
import { CONTENEDOR_EVIDENCIAS, type AlmacenEvidencias, type UrlFirmada } from "../dominio/puertos";

export const VIGENCIA_SAS_MS = 5 * 60 * 1000;
/** Tolera relojes del celular o del servidor algo adelantados. */
const MARGEN_RELOJ_MS = 60 * 1000;

type Firmante = { protocolo: SASProtocol; firmar(valores: BlobSASSignatureValues): Promise<string> };
export type ConfigAlmacen = { modo: "pruebas"; conexion: string; contenedor?: string };

function firmantePruebas(servicio: BlobServiceClient): Firmante {
  const credencial = servicio.credential;
  if (!(credencial instanceof StorageSharedKeyCredential)) throw new Error("almacen_pruebas_sin_clave");
  // Azurite expone http; solo en pruebas se admite.
  return { protocolo: SASProtocol.HttpsAndHttp, firmar: async valores => generateBlobSASQueryParameters(valores, credencial).toString() };
}

export function crearAlmacenEvidencias(config: ConfigAlmacen): Pick<AlmacenEvidencias, "urlSubida"> {
  const servicio = BlobServiceClient.fromConnectionString(config.conexion);
  const firmante = firmantePruebas(servicio);
  const contenedor = servicio.getContainerClient(config.contenedor ?? CONTENEDOR_EVIDENCIAS);

  async function firmarUrl(blobNombre: string, ahora: Date, permisos: BlobSASPermissions, extra: Partial<BlobSASSignatureValues> = {}): Promise<UrlFirmada> {
    const expiresOn = new Date(ahora.getTime() + VIGENCIA_SAS_MS);
    const sas = await firmante.firmar({
      containerName: contenedor.containerName, blobName: blobNombre, permissions: permisos,
      startsOn: new Date(ahora.getTime() - MARGEN_RELOJ_MS), expiresOn, protocol: firmante.protocolo, ...extra,
    });
    return { url: `${contenedor.getBlobClient(blobNombre).url}?${sas}`, expiraEn: expiresOn.toISOString() };
  }

  return {
    urlSubida: (blobNombre, ahora) => firmarUrl(blobNombre, ahora, BlobSASPermissions.from({ create: true })),
  };
}
