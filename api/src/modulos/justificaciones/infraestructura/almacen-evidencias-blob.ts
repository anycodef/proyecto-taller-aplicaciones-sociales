import { ManagedIdentityCredential } from "@azure/identity";
import {
  BlobSASPermissions, BlobServiceClient, SASProtocol, StorageSharedKeyCredential, generateBlobSASQueryParameters, type BlobSASSignatureValues, type UserDelegationKey,
} from "@azure/storage-blob";
import { tieneFirmaJpeg } from "@/lib/justificaciones/evidencia";
import { CONTENEDOR_EVIDENCIAS, type AlmacenEvidencias, type InspeccionBlob, type UrlFirmada } from "../dominio/puertos";

export const VIGENCIA_SAS_MS = 5 * 60 * 1000;
/** Tolera relojes del celular o del servidor algo adelantados. */
const MARGEN_RELOJ_MS = 60 * 1000;

type Firmante = { protocolo: SASProtocol; firmar(valores: BlobSASSignatureValues): Promise<string> };
export type ConfigAlmacen = { modo: "azure"; cuentaUrl: string; contenedor?: string } | { modo: "pruebas"; conexion: string; contenedor?: string };

/** La clave de delegación dura una hora y se renueva antes de que una SAS pueda superarla. */
const VIGENCIA_CLAVE_MS = 60 * 60 * 1000;
const RENOVAR_CLAVE_ANTES_MS = VIGENCIA_SAS_MS + 2 * MARGEN_RELOJ_MS;

/** En Azure la SAS se firma con la identidad administrada; nunca con la clave de la cuenta (RNF-403). */
function firmanteAzure(servicio: BlobServiceClient): Firmante {
  let clave: { valor: UserDelegationKey; venceEn: number } | undefined;
  async function vigente(): Promise<UserDelegationKey> {
    const ahora = Date.now();
    if (!clave || clave.venceEn - ahora < RENOVAR_CLAVE_ANTES_MS) {
      const venceEn = ahora + VIGENCIA_CLAVE_MS;
      clave = { valor: await servicio.getUserDelegationKey(new Date(ahora - MARGEN_RELOJ_MS), new Date(venceEn)), venceEn };
    }
    return clave.valor;
  }
  return { protocolo: SASProtocol.Https, firmar: async valores => generateBlobSASQueryParameters(valores, await vigente(), servicio.accountName).toString() };
}

function firmantePruebas(servicio: BlobServiceClient): Firmante {
  const credencial = servicio.credential;
  if (!(credencial instanceof StorageSharedKeyCredential)) throw new Error("almacen_pruebas_sin_clave");
  // Azurite expone http; solo en pruebas se admite.
  return { protocolo: SASProtocol.HttpsAndHttp, firmar: async valores => generateBlobSASQueryParameters(valores, credencial).toString() };
}

export function crearAlmacenEvidencias(config: ConfigAlmacen): AlmacenEvidencias {
  const servicio = config.modo === "azure" ? new BlobServiceClient(config.cuentaUrl, new ManagedIdentityCredential()) : BlobServiceClient.fromConnectionString(config.conexion);
  const firmante = config.modo === "azure" ? firmanteAzure(servicio) : firmantePruebas(servicio);
  const contenedor = servicio.getContainerClient(config.contenedor ?? CONTENEDOR_EVIDENCIAS);

  async function firmarUrl(blobNombre: string, ahora: Date, permisos: BlobSASPermissions, extra: Partial<BlobSASSignatureValues> = {}): Promise<UrlFirmada> {
    const expiresOn = new Date(ahora.getTime() + VIGENCIA_SAS_MS);
    const sas = await firmante.firmar({
      containerName: contenedor.containerName, blobName: blobNombre, permissions: permisos,
      startsOn: new Date(ahora.getTime() - MARGEN_RELOJ_MS), expiresOn, protocol: firmante.protocolo, ...extra,
    });
    return { url: `${contenedor.getBlobClient(blobNombre).url}?${sas}`, expiraEn: expiresOn.toISOString() };
  }

  async function inspeccionar(blobNombre: string): Promise<InspeccionBlob | undefined> {
    const blob = contenedor.getBlobClient(blobNombre);
    try {
      const propiedades = await blob.getProperties();
      const inicio = await blob.downloadToBuffer(0, 3);
      return { bytes: propiedades.contentLength ?? 0, contentType: propiedades.contentType ?? "", firmaJpeg: tieneFirmaJpeg(inicio) };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return undefined;
      throw error;
    }
  }

  async function borrar(blobNombre: string): Promise<void> {
    await contenedor.getBlobClient(blobNombre).deleteIfExists({ deleteSnapshots: "include" });
  }

  async function borrarPrefijo(prefijo: string): Promise<number> {
    if (!prefijo.endsWith("/")) throw new Error("prefijo_sin_barra");
    let cantidad = 0;
    for await (const item of contenedor.listBlobsFlat({ prefix: prefijo })) {
      await borrar(item.name);
      cantidad += 1;
    }
    return cantidad;
  }

  return {
    urlSubida: (blobNombre, ahora) => firmarUrl(blobNombre, ahora, BlobSASPermissions.from({ create: true })),
    urlLectura: (blobNombre, ahora) => firmarUrl(blobNombre, ahora, BlobSASPermissions.from({ read: true }), { cacheControl: "no-store" }),
    inspeccionar,
    borrar,
    borrarPrefijo,
  };
}

/**
 * Fuera de pruebas solo se lee la URL de la cuenta: ninguna configuración de producción trae la clave.
 * El modo de pruebas se rechaza dentro de Azure Functions (WEBSITE_SITE_NAME).
 */
export function configAlmacenDesdeEntorno(entorno: NodeJS.ProcessEnv = process.env): ConfigAlmacen {
  if (entorno.EVIDENCIAS_MODO === "pruebas") {
    if (entorno.WEBSITE_SITE_NAME) throw new Error("almacen_pruebas_en_azure");
    return { modo: "pruebas", conexion: entorno.EVIDENCIAS_CONEXION_PRUEBAS ?? "UseDevelopmentStorage=true" };
  }
  const cuentaUrl = entorno.EVIDENCIAS_CUENTA_URL;
  if (!cuentaUrl || new URL(cuentaUrl).protocol !== "https:") throw new Error("Falta EVIDENCIAS_CUENTA_URL https");
  return { modo: "azure", cuentaUrl };
}
