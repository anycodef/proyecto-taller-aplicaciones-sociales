import { randomUUID } from "node:crypto";
import { prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

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
