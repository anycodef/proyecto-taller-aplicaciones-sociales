import { randomUUID } from "node:crypto";
import { repositorioJustificacionesPg as repo } from "../../../src/modulos/justificaciones/infraestructura/repositorio-justificaciones-pg";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
beforeAll(async () => { bd = await prepararBd("plazo004"); s = await sembrar(bd); });
afterAll(async () => { await bd?.cerrar(); });

test("RF-405: dias_plazo fuera de 1 a 60 es rechazado por la restricción", async () => {
  const insertar = (dias: number) => bd.app.query("INSERT INTO justificacion_plazo(ciclo_id,dias_plazo,definido_por) VALUES($1,$2,$3)", [s.cicloId, dias, s.cuentaId]);
  await expect(insertar(0)).rejects.toMatchObject({ code: "23514" });
  await expect(insertar(61)).rejects.toMatchObject({ code: "23514" });
  await expect(insertar(60)).resolves.toMatchObject({ rowCount: 1 });
  await bd.admin.query("DELETE FROM justificacion_plazo WHERE ciclo_id=$1", [s.cicloId]);
});

test("RF-405: obtenerPlazo devuelve 7 si el ciclo no lo definió", async () => {
  expect(await enTx(bd, tx => repo.obtenerPlazo(tx, s.cicloId))).toEqual({ cicloId: s.cicloId, diasPlazo: 7, predeterminado: true, definidoPor: null, definidoEn: null });
});

test("RF-405: definirPlazo guarda definido_por y definido_en", async () => {
  const en = new Date("2026-03-02T14:00:00.000Z");
  const esperado = { cicloId: s.cicloId, diasPlazo: 10, predeterminado: false, definidoPor: s.cuentaId, definidoEn: en.toISOString() };
  expect(await enTx(bd, tx => repo.definirPlazo(tx, s.cicloId, 10, s.cuentaId, en))).toEqual(esperado);
  expect(await enTx(bd, tx => repo.obtenerPlazo(tx, s.cicloId))).toEqual(esperado);
  const otra = randomUUID();
  await bd.admin.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Delegado 1',false)", [otra]);
  const despues = new Date("2026-03-05T14:00:00.000Z");
  expect(await enTx(bd, tx => repo.definirPlazo(tx, s.cicloId, 14, otra, despues))).toMatchObject({ diasPlazo: 14, definidoPor: otra, definidoEn: despues.toISOString() });
  await expect(enTx(bd, tx => repo.definirPlazo(tx, s.cicloId, 0, otra, despues))).rejects.toThrow("plazo_invalido");
});
