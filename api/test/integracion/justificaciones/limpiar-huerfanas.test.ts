import { randomUUID } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import type { Pool } from "pg";
import { CRON_LIMPIAR_HUERFANAS, limpiarEvidenciasHuerfanas } from "../../../src/modulos/justificaciones/aplicacion/limpiar-huerfanas";
import { nombreBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { crearAlmacenEvidencias } from "../../../src/modulos/justificaciones/infraestructura/almacen-evidencias-blob";
import { repositorioEvidenciasPg as repo } from "../../../src/modulos/justificaciones/infraestructura/repositorio-evidencias-pg";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let pool: Pool;
let s: Semilla;
jest.mock("../../../src/compartido/bd/pool", () => ({ obtenerPool: () => pool, consultar: (texto: string, valores: unknown[]) => pool.query(texto, valores) }));

const conexion = process.env.AZURITE_PRUEBAS_CONEXION ?? "UseDevelopmentStorage=true";
const contenedor = BlobServiceClient.fromConnectionString(conexion).getContainerClient(`evidencias-${randomUUID()}`);
const almacen = crearAlmacenEvidencias({ modo: "pruebas", conexion, contenedor: contenedor.containerName });
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(996, 1)]);
// Reloj falso: 03:00 de Lima del 10 de noviembre.
const ahora = new Date("2026-11-10T08:00:00Z");
const horasAntes = (h: number) => new Date(ahora.getTime() - h * 3600000);
const ids = { vieja: randomUUID(), reciente: randomUUID(), confirmada: randomUUID() };

const blob = (id: string) => nombreBlob(s.cicloId, id, 1);
const existe = (id: string) => contenedor.getBlobClient(blob(id)).exists();
const estado = async (id: string) => (await bd.admin.query("SELECT estado,motivo_eliminacion FROM evidencia WHERE id=$1", [id])).rows[0];

beforeAll(async () => {
  await contenedor.create();
  bd = await prepararBd("huerf004");
  pool = bd.app;
  s = await sembrar(bd);
  await enTx(bd, async tx => {
    await repo.reservar(tx, { id: ids.vieja, cicloId: s.cicloId, subidaPor: s.cuentaId, en: horasAntes(25) });
    await repo.reservar(tx, { id: ids.reciente, cicloId: s.cicloId, subidaPor: s.cuentaId, en: horasAntes(2) });
    await repo.reservar(tx, { id: ids.confirmada, cicloId: s.cicloId, subidaPor: s.cuentaId, en: horasAntes(48) });
    await repo.confirmar(tx, ids.confirmada, [{ orden: 1, blobNombre: blob(ids.confirmada), bytes: jpeg.length, contentType: "image/jpeg" }], horasAntes(47));
  });
  for (const id of Object.values(ids)) await contenedor.getBlockBlobClient(blob(id)).upload(jpeg, jpeg.length);
});
afterAll(async () => {
  await contenedor.deleteIfExists();
  await bd?.cerrar();
});

test("RNF-403: el temporizador corre a las 03:00 de Lima, expresado en UTC", () => {
  expect(CRON_LIMPIAR_HUERFANAS).toBe("0 0 8 * * *");
});

test("RNF-403: las reservas no confirmadas de más de 24 h se borran y se marcan huerfana", async () => {
  expect(await limpiarEvidenciasHuerfanas(ahora, repo, () => almacen)).toEqual({ eliminadas: 1, blobs: 1 });
  expect(await estado(ids.vieja)).toEqual({ estado: "eliminada", motivo_eliminacion: "huerfana" });
  expect(await existe(ids.vieja)).toBe(false);
  expect(await estado(ids.reciente)).toEqual({ estado: "reservada", motivo_eliminacion: null });
  expect(await existe(ids.reciente)).toBe(true);
  expect(await limpiarEvidenciasHuerfanas(ahora, repo, () => almacen)).toEqual({ eliminadas: 0, blobs: 0 });
});

test("RNF-403: la limpieza no toca las evidencias confirmadas", async () => {
  await limpiarEvidenciasHuerfanas(new Date(ahora.getTime() + 30 * 24 * 3600000), repo, () => almacen);
  expect(await estado(ids.confirmada)).toEqual({ estado: "confirmada", motivo_eliminacion: null });
  expect(await existe(ids.confirmada)).toBe(true);
});
