import { randomUUID } from "node:crypto";
import { nombreBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { repositorioEvidenciasPg as repo } from "../../../src/modulos/justificaciones/infraestructura/repositorio-evidencias-pg";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
beforeAll(async () => { bd = await prepararBd("evid004"); s = await sembrar(bd); });
afterAll(async () => { await bd?.cerrar(); });

async function reservar(): Promise<string> {
  const id = randomUUID();
  await bd.app.query("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [id, s.cicloId, s.cuentaId]);
  return id;
}
const archivo = (evidenciaId: string, orden: number, bytes: number) =>
  bd.app.query("INSERT INTO evidencia_archivo(evidencia_id,orden,blob_nombre,bytes,content_type) VALUES($1,$2,$3,$4,'image/jpeg')", [evidenciaId, orden, `${s.cicloId}/${evidenciaId}/${orden}.jpg`, bytes]);

test("RNF-402: evidencia_archivo rechaza bytes mayores de 307200", async () => {
  const id = await reservar();
  await expect(archivo(id, 1, 307_201)).rejects.toMatchObject({ code: "23514" });
  await expect(archivo(id, 1, 307_200)).resolves.toMatchObject({ rowCount: 1 });
  await expect(bd.app.query("INSERT INTO evidencia_archivo(evidencia_id,orden,blob_nombre,bytes,content_type) VALUES($1,2,'x.png',10,'image/png')", [id])).rejects.toMatchObject({ code: "23514" });
});

test("RF-402: orden fuera de 1 a 3 es rechazado", async () => {
  const id = await reservar();
  await expect(archivo(id, 0, 100)).rejects.toMatchObject({ code: "23514" });
  await expect(archivo(id, 4, 100)).rejects.toMatchObject({ code: "23514" });
  await expect(archivo(id, 3, 100)).resolves.toMatchObject({ rowCount: 1 });
});

test("RNF-403: una evidencia nace en estado reservada", async () => {
  const id = await reservar();
  const fila = (await bd.app.query("SELECT estado,confirmada_en,eliminada_en FROM evidencia WHERE id=$1", [id])).rows[0];
  expect(fila).toEqual({ estado: "reservada", confirmada_en: null, eliminada_en: null });
  await expect(bd.app.query("UPDATE evidencia SET estado='confirmada' WHERE id=$1", [id])).rejects.toMatchObject({ code: "23514" });
});

const ahora = new Date("2026-11-04T15:00:00Z");
const horasAntes = (h: number) => new Date(ahora.getTime() - h * 60 * 60 * 1000);

test("RNF-403: reservar y confirmar una evidencia con sus archivos", async () => {
  const id = randomUUID();
  const archivos = [1, 2].map(orden => ({ orden, blobNombre: nombreBlob(s.cicloId, id, orden), bytes: 120_000, contentType: "image/jpeg" }));
  await enTx(bd, tx => repo.reservar(tx, { id, cicloId: s.cicloId, subidaPor: s.cuentaId, en: ahora }));
  expect(await enTx(bd, tx => repo.obtener(tx, id))).toMatchObject({ estado: "reservada", confirmadaEn: null, archivos: [] });
  expect(await enTx(bd, tx => repo.confirmar(tx, id, archivos, ahora))).toBe(true);
  expect(await enTx(bd, tx => repo.confirmar(tx, id, archivos, ahora))).toBe(false);
  expect(await enTx(bd, tx => repo.obtener(tx, id))).toEqual({ id, cicloId: s.cicloId, subidaPor: s.cuentaId, estado: "confirmada", reservadaEn: ahora.toISOString(), confirmadaEn: ahora.toISOString(), archivos });
  expect(await enTx(bd, tx => repo.marcarEliminada(tx, id, "consentimiento"))).toBe(true);
  expect((await enTx(bd, tx => repo.obtener(tx, id)))?.estado).toBe("eliminada");
});

test("RNF-403: listarHuerfanas devuelve solo las reservas no confirmadas de más de 24 h", async () => {
  const [vieja, reciente, confirmada] = [randomUUID(), randomUUID(), randomUUID()];
  await enTx(bd, async tx => {
    await repo.reservar(tx, { id: vieja, cicloId: s.cicloId, subidaPor: s.cuentaId, en: horasAntes(25) });
    await repo.reservar(tx, { id: reciente, cicloId: s.cicloId, subidaPor: s.cuentaId, en: horasAntes(23) });
    await repo.reservar(tx, { id: confirmada, cicloId: s.cicloId, subidaPor: s.cuentaId, en: horasAntes(30) });
    await repo.confirmar(tx, confirmada, [{ orden: 1, blobNombre: nombreBlob(s.cicloId, confirmada, 1), bytes: 10, contentType: "image/jpeg" }], horasAntes(29));
  });
  const ids = (await enTx(bd, tx => repo.listarHuerfanas(tx, ahora))).map(e => e.id);
  expect(ids).toContain(vieja);
  expect(ids).not.toContain(reciente);
  expect(ids).not.toContain(confirmada);
});

test("RNF-403: cuenta las reservas de una cuenta en la última hora", async () => {
  const otraCuenta = randomUUID();
  await bd.admin.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Familia 1',false)", [otraCuenta]);
  await enTx(bd, async tx => {
    await repo.reservar(tx, { id: randomUUID(), cicloId: s.cicloId, subidaPor: otraCuenta, en: horasAntes(0.5) });
    await repo.reservar(tx, { id: randomUUID(), cicloId: s.cicloId, subidaPor: otraCuenta, en: horasAntes(0.1) });
    await repo.reservar(tx, { id: randomUUID(), cicloId: s.cicloId, subidaPor: otraCuenta, en: horasAntes(2) });
  });
  expect(await enTx(bd, tx => repo.contarReservasRecientes(tx, otraCuenta, ahora))).toBe(2);
});
