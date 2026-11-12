import { BlobSASPermissions, BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { CONTENEDOR_EVIDENCIAS, type AlmacenEvidencias } from "../dominio/puertos";

const MINUTOS_SAS = 5;

/** La SAS necesita clave de cuenta (cadena de conexión); con identidad administrada habría que delegar la clave de usuario. */
export function crearAlmacenEvidenciasBlob(conexion: string | undefined = process.env.BLOBS_CONEXION): AlmacenEvidencias {
  let contenedor: ContainerClient | undefined;
  const obtenerContenedor = async (): Promise<ContainerClient> => {
    if (!conexion) throw new ErrorAplicacion(503, "almacen_no_configurado");
    contenedor ??= BlobServiceClient.fromConnectionString(conexion).getContainerClient(CONTENEDOR_EVIDENCIAS);
    await contenedor.createIfNotExists();
    return contenedor;
  };
  const firmar = async (blobNombre: string, permisos: string, ahora: Date) => {
    const expiraEn = new Date(ahora.getTime() + MINUTOS_SAS * 60_000);
    const url = await (await obtenerContenedor()).getBlobClient(blobNombre)
      .generateSasUrl({ permissions: BlobSASPermissions.parse(permisos), expiresOn: expiraEn, cacheControl: "no-store" });
    return { url, expiraEn: expiraEn.toISOString() };
  };
  return {
    async subir(blobNombre, contenido, contentType) {
      await (await obtenerContenedor()).getBlockBlobClient(blobNombre).uploadData(contenido, { blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: "no-store" } });
    },
    urlSubida: (blobNombre, ahora) => firmar(blobNombre, "cw", ahora),
    urlLectura: (blobNombre, ahora) => firmar(blobNombre, "r", ahora),
    async inspeccionar(blobNombre) {
      const blob = (await obtenerContenedor()).getBlobClient(blobNombre);
      if (!(await blob.exists())) return undefined;
      const propiedades = await blob.getProperties();
      return { bytes: propiedades.contentLength ?? 0, contentType: propiedades.contentType ?? "" };
    },
    async borrar(blobNombre) {
      await (await obtenerContenedor()).getBlobClient(blobNombre).deleteIfExists({ deleteSnapshots: "include" });
    },
  };
}

/** Doble para las pruebas: nunca sale a la red. */
export function crearAlmacenEvidenciasMemoria(): AlmacenEvidencias & { blobs: Map<string, { contenido: Buffer; contentType: string }> } {
  const blobs = new Map<string, { contenido: Buffer; contentType: string }>();
  const firma = (blobNombre: string, ahora: Date) => ({ url: `https://almacen.prueba/${blobNombre}?sas=1`, expiraEn: new Date(ahora.getTime() + MINUTOS_SAS * 60_000).toISOString() });
  return {
    blobs,
    async subir(blobNombre, contenido, contentType) { blobs.set(blobNombre, { contenido, contentType }); },
    async urlSubida(blobNombre, ahora) { return firma(blobNombre, ahora); },
    async urlLectura(blobNombre, ahora) { return firma(blobNombre, ahora); },
    async inspeccionar(blobNombre) {
      const blob = blobs.get(blobNombre);
      return blob && { bytes: blob.contenido.length, contentType: blob.contentType };
    },
    async borrar(blobNombre) { blobs.delete(blobNombre); },
  };
}

let almacen: AlmacenEvidencias | undefined;
export const configurarAlmacenEvidencias = (puerto: AlmacenEvidencias | undefined): void => { almacen = puerto; };
export const obtenerAlmacenEvidencias = (): AlmacenEvidencias => (almacen ??= crearAlmacenEvidenciasBlob());
