import { randomUUID } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import type { PoolClient } from "pg";
import { expandirLote } from "@/lib/justificaciones/lote";
import { crearBorradorConEvidencias, eliminarEvidenciasDeCiclo, participanteRetencionJustificaciones as participante } from "../../../src/modulos/justificaciones/aplicacion/depurar-evidencias";
import { nombreBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { crearAlmacenEvidencias } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";
import { repositorioEvidenciasPg } from "../../../src/modulos/justificaciones/infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg } from "../../../src/modulos/justificaciones/infraestructura/repositorio-justificaciones-pg";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
const contenedor = BlobServiceClient.fromConnectionString(conexion).getContainerClient(`evidencias-${randomUUID()}`);
const almacen = crearAlmacenEvidencias({ modo: "pruebas", conexion, contenedor: contenedor.containerName });
const ajenos: string[] = [];
const borrador = crearBorradorConEvidencias({ async borrar(ref) { ajenos.push(`${ref.contenedor}/${ref.ruta}`); } }, () => almacen);
const ahora = new Date("2026-11-04T15:00:00Z");
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(996, 1)]);
const existe = (nombre: string) => contenedor.getBlobClient(nombre).exists();
const subir = (nombre: string) => contenedor.getBlockBlobClient(nombre).upload(jpeg, jpeg.length, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });

let bd: BdPrueba;
let s: Semilla;
beforeAll(async () => {
  await contenedor.create();
  bd = await prepararBd("depurar004");
  s = await sembrar(bd);
});
afterAll(async () => {
  await contenedor.deleteIfExists();
  await bd?.cerrar();
});

async function enRetencion<T>(operacion: (tx: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await bd.admin.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET LOCAL ROLE sigecat_retencion");
    await cliente.query("SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
    const resultado = await operacion(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) { await cliente.query("ROLLBACK"); throw error; } finally { cliente.release(); }
}

test("RF-407: depurar borra el blob y conserva la justificación", async () => {
  const evidenciaId = randomUUID();
  const nombre = nombreBlob(s.cicloId, evidenciaId, 1);
  await subir(nombre);
  const js = expandirLote({
    loteId: randomUUID(), cicloId: s.cicloId, causa: "salud_nino", evidenciaId, cantidadFotos: 1, apoderadoId: s.apoderadoId, canal: "enlace",
    ausencias: [s.catequizandoId, s.hermanoId].map(catequizandoId => ({ catequizandoId, sesionId: s.sesionId, tipoSesion: "misa" as const, fecha: "2026-11-01", justificacionId: randomUUID(), anticipada: false })),
  }, ahora.toISOString());
  await enTx(bd, async tx => {
    await repositorioEvidenciasPg.reservar(tx, { id: evidenciaId, cicloId: s.cicloId, subidaPor: s.cuentaId, en: ahora });
    await repositorioEvidenciasPg.confirmar(tx, evidenciaId, [{ orden: 1, blobNombre: nombre, bytes: jpeg.length, contentType: "image/jpeg" }], ahora);
    await repositorioJustificacionesPg.insertarLote(tx, js, s.cuentaId);
  });

  const { blobs } = await enRetencion(tx => participante.alRetirarConsentimiento(s.catequizandoId, tx));
  for (const ref of blobs) await borrador.borrar(ref);

  expect(await existe(nombre)).toBe(false);
  expect(ajenos).toEqual([]);
  const delHermano = (await bd.app.query("SELECT estado_revision FROM justificacion WHERE id=$1", [js[1]!.id])).rows;
  expect(delHermano).toEqual([{ estado_revision: "pendiente" }]);
  expect((await bd.app.query("SELECT estado FROM evidencia WHERE id=$1", [evidenciaId])).rows[0].estado).toBe("eliminada");
});

test("RF-407: el borrador deja a 001 los blobs de otros contenedores", async () => {
  await borrador.borrar({ contenedor: "fichas", ruta: "x/1.pdf" });
  expect(ajenos).toEqual(["fichas/x/1.pdf"]);
});

test("RF-407: eliminarEvidenciasDeCiclo borra por prefijo de ciclo", async () => {
  const otroCiclo = randomUUID();
  const delCiclo = [nombreBlob(s.cicloId, randomUUID(), 1), nombreBlob(s.cicloId, randomUUID(), 2)];
  const ajeno = nombreBlob(otroCiclo, randomUUID(), 1);
  for (const nombre of [...delCiclo, ajeno]) await subir(nombre);
  expect(await eliminarEvidenciasDeCiclo(s.cicloId, almacen)).toBe(2);
  for (const nombre of delCiclo) expect(await existe(nombre)).toBe(false);
  expect(await existe(ajeno)).toBe(true);
  expect(await eliminarEvidenciasDeCiclo(s.cicloId, almacen)).toBe(0);
  await expect(eliminarEvidenciasDeCiclo("../otro", almacen)).rejects.toMatchObject({ estado: 422 });
});
