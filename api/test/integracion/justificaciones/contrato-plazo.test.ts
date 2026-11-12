import { prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
beforeAll(async () => { bd = await prepararBd("plazo004"); s = await sembrar(bd); });
afterAll(async () => { await bd?.cerrar(); });

test("RF-405: dias_plazo fuera de 1 a 60 es rechazado por la restricción", async () => {
  const insertar = (dias: number) => bd.app.query("INSERT INTO justificacion_plazo(ciclo_id,dias_plazo,definido_por) VALUES($1,$2,$3)", [s.cicloId, dias, s.cuentaId]);
  await expect(insertar(0)).rejects.toMatchObject({ code: "23514" });
  await expect(insertar(61)).rejects.toMatchObject({ code: "23514" });
  await expect(insertar(60)).resolves.toMatchObject({ rowCount: 1 });
});
