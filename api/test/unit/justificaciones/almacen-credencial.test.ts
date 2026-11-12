const getUserDelegationKey = jest.fn(async () => ({ signedObjectId: "oid", value: "clave-delegada" }));
const generar = jest.fn(() => ({ toString: () => "sv=2025&sig=firmada" }));
const desdeConexion = jest.fn();
const claveCompartida = jest.fn();
const identidad = jest.fn();

jest.mock("@azure/identity", () => ({ ManagedIdentityCredential: jest.fn().mockImplementation(() => { identidad(); return {}; }) }));
jest.mock("@azure/storage-blob", () => {
  const real = jest.requireActual("@azure/storage-blob");
  class ServicioFalso {
    accountName = "sigecatprod";
    static fromConnectionString(...args: unknown[]) { desdeConexion(...args); throw new Error("no debe usarse en Azure"); }
    constructor(readonly url: string, readonly credential: unknown) {}
    getUserDelegationKey = getUserDelegationKey;
    getContainerClient(nombre: string) {
      return { containerName: nombre, getBlobClient: (blob: string) => ({ url: `${this.url}/${nombre}/${blob}` }) };
    }
  }
  return { ...real, BlobServiceClient: ServicioFalso, generateBlobSASQueryParameters: generar, StorageSharedKeyCredential: jest.fn().mockImplementation(() => { claveCompartida(); return {}; }) };
});

// Va después de los dobles: sus fábricas leen constantes que deben existir al cargar el módulo.
// eslint-disable-next-line import/first
import { configAlmacenDesdeEntorno, crearAlmacenEvidencias } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";

test("RNF-403: en Azure se usa SAS de usuario delegado y nunca la clave de cuenta", async () => {
  const config = configAlmacenDesdeEntorno({ EVIDENCIAS_CUENTA_URL: "https://sigecatprod.blob.core.windows.net", EVIDENCIAS_CONEXION_PRUEBAS: "AccountKey=no-debe-leerse", WEBSITE_SITE_NAME: "sigecat-api" });
  expect(config).toEqual({ modo: "azure", cuentaUrl: "https://sigecatprod.blob.core.windows.net" });
  const almacen = crearAlmacenEvidencias(config);
  const primera = await almacen.urlSubida("c/e/1.jpg", new Date());
  await almacen.urlSubida("c/e/2.jpg", new Date());
  expect(identidad).toHaveBeenCalledTimes(1);
  expect(getUserDelegationKey).toHaveBeenCalledTimes(1);
  expect(generar).toHaveBeenCalledWith(expect.objectContaining({ protocol: "https" }), { signedObjectId: "oid", value: "clave-delegada" }, "sigecatprod");
  expect(desdeConexion).not.toHaveBeenCalled();
  expect(claveCompartida).not.toHaveBeenCalled();
  expect(primera.url).toBe("https://sigecatprod.blob.core.windows.net/evidencias/c/e/1.jpg?sv=2025&sig=firmada");
});

test("RNF-403: el modo de pruebas se rechaza dentro de Azure y Azure exige una URL https", () => {
  expect(() => configAlmacenDesdeEntorno({ EVIDENCIAS_MODO: "pruebas", WEBSITE_SITE_NAME: "sigecat-api" })).toThrow("almacen_pruebas_en_azure");
  expect(() => configAlmacenDesdeEntorno({})).toThrow("EVIDENCIAS_CUENTA_URL");
  expect(() => configAlmacenDesdeEntorno({ EVIDENCIAS_CUENTA_URL: "http://127.0.0.1:10000/devstoreaccount1" })).toThrow("EVIDENCIAS_CUENTA_URL");
  expect(configAlmacenDesdeEntorno({ EVIDENCIAS_MODO: "pruebas" })).toEqual({ modo: "pruebas", conexion: "UseDevelopmentStorage=true" });
});
