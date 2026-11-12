import { randomUUID } from "node:crypto";
import { prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
let evidenciaId: string;
beforeAll(async () => {
  bd = await prepararBd("just004");
  s = await sembrar(bd);
  evidenciaId = randomUUID();
  await bd.app.query("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidenciaId, s.cicloId, s.cuentaId]);
});
afterAll(async () => { await bd?.cerrar(); });

type Fila = Record<string, unknown>;
function insertar(cambios: Fila = {}) {
  const fila: Fila = {
    id: randomUUID(), lote_id: randomUUID(), ciclo_id: s.cicloId, catequizando_id: s.catequizandoId, sesion_id: s.sesionId,
    tipo_sesion: "misa", fecha_sesion: "2026-11-01", causa: "salud_nino", evidencia_id: evidenciaId, enviada_por: s.apoderadoId, canal: "enlace", ...cambios,
  };
  const columnas = Object.keys(fila);
  return bd.app.query(`INSERT INTO justificacion(${columnas.join(",")}) VALUES(${columnas.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(fila));
}
const revisada = () => ({ revisada_por: s.cuentaId, revisada_en: "2026-11-03T10:00:00-05:00" });

test("RF-406: el canal coordinación exige registrada_por", async () => {
  await expect(insertar({ canal: "coordinacion" })).rejects.toMatchObject({ code: "23514" });
  await expect(insertar({ registrada_por: s.cuentaId, registrada_en: "2026-11-02T10:00:00-05:00" })).rejects.toMatchObject({ code: "23514" });
  await expect(insertar({ canal: "coordinacion", registrada_por: s.cuentaId, registrada_en: "2026-11-02T10:00:00-05:00" })).resolves.toMatchObject({ rowCount: 1 });
});

test("RF-408: rechazada exige motivo_rechazo", async () => {
  await expect(insertar({ estado_revision: "rechazada", ...revisada() })).rejects.toMatchObject({ code: "23514" });
  await expect(insertar({ estado_revision: "aprobada", motivo_rechazo: "x", ...revisada() })).rejects.toMatchObject({ code: "23514" });
  await expect(insertar({ estado_revision: "rechazada", motivo_rechazo: "Foto ilegible", ...revisada() })).resolves.toMatchObject({ rowCount: 1 });
});

test("RF-408: una revisada exige revisada_por", async () => {
  await expect(insertar({ estado_revision: "aprobada" })).rejects.toMatchObject({ code: "23514" });
  await expect(insertar(revisada())).rejects.toMatchObject({ code: "23514" });
});

test("RF-408: dos justificaciones de la misma ausencia se aceptan", async () => {
  await insertar({ sesion_id: s.sesion2Id, tipo_sesion: "catequesis" });
  await insertar({ sesion_id: s.sesion2Id, tipo_sesion: "catequesis" });
  const cantidad = (await bd.app.query("SELECT count(*)::int AS n FROM justificacion WHERE catequizando_id=$1 AND sesion_id=$2", [s.catequizandoId, s.sesion2Id])).rows[0].n;
  expect(cantidad).toBe(2);
});

test("RF-404: solo el evento escolar se marca como anticipado", async () => {
  await expect(insertar({ anticipada: true })).rejects.toMatchObject({ code: "23514" });
  await expect(insertar({ anticipada: true, causa: "evento_escolar" })).resolves.toMatchObject({ rowCount: 1 });
});
