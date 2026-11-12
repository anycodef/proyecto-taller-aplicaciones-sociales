import { randomUUID } from "node:crypto";
import { expandirLote } from "@/lib/justificaciones/lote";
import type { EntradaLote } from "@/lib/justificaciones/tipos";
import { repositorioJustificacionesPg as repo } from "../../../src/modulos/justificaciones/infraestructura/repositorio-justificaciones-pg";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

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

const enviadaEn = "2026-11-02T10:00:00.000Z";
function lote(parcial: Partial<EntradaLote> = {}): EntradaLote {
  return {
    loteId: randomUUID(), cicloId: s.cicloId, causa: "salud_nino", evidenciaId, cantidadFotos: 1, apoderadoId: s.apoderadoId, canal: "enlace",
    ausencias: [
      { catequizandoId: s.catequizandoId, sesionId: s.sesionId, tipoSesion: "misa", fecha: "2026-11-01", justificacionId: randomUUID(), anticipada: false },
      { catequizandoId: s.hermanoId, sesionId: s.sesionId, tipoSesion: "misa", fecha: "2026-11-01", justificacionId: randomUUID(), anticipada: false },
    ],
    ...parcial,
  };
}
const contar = async (tabla: string, columna: string, ids: string[]) =>
  (await bd.app.query(`SELECT count(*)::int AS n FROM ${tabla} WHERE ${columna}=ANY($1::uuid[])`, [ids])).rows[0].n as number;

test("RF-403: reinsertar el mismo lote es idempotente", async () => {
  const js = expandirLote(lote(), enviadaEn);
  const primera = await enTx(bd, tx => repo.insertarLote(tx, js, s.cuentaId));
  const segunda = await enTx(bd, tx => repo.insertarLote(tx, js, s.cuentaId));
  expect(segunda).toEqual(primera);
  expect(primera).toHaveLength(2);
  expect(primera.map(j => j.evidenciaId)).toEqual([evidenciaId, evidenciaId]);
  expect(await contar("justificacion", "id", js.map(j => j.id))).toBe(2);
  expect(await contar("justificacion_evento", "justificacion_id", js.map(j => j.id))).toBe(2);
});

test("RF-403: si falla una inserción del lote no queda ninguna", async () => {
  const entrada = lote();
  entrada.ausencias[1] = { ...entrada.ausencias[1], sesionId: randomUUID() };
  const js = expandirLote(entrada, enviadaEn);
  const quedan = await enTx(bd, async tx => {
    await expect(repo.insertarLote(tx, js, s.cuentaId)).rejects.toMatchObject({ code: "23503" });
    return (await tx.query("SELECT count(*)::int AS n FROM justificacion WHERE lote_id=$1", [entrada.loteId])).rows[0].n;
  });
  expect(quedan).toBe(0);
  expect(await contar("justificacion", "id", js.map(j => j.id))).toBe(0);
  const otroLote = expandirLote(lote(), enviadaEn).map((j, i) => (i === 0 ? { ...j, id: js[0].id } : j));
  await enTx(bd, tx => repo.insertarLote(tx, expandirLote(lote({ loteId: js[0].loteId, ausencias: [{ ...lote().ausencias[0], justificacionId: js[0].id }] }), enviadaEn), s.cuentaId));
  await expect(enTx(bd, tx => repo.insertarLote(tx, otroLote, s.cuentaId))).rejects.toThrow("lote_en_conflicto");
});

test("RF-407: cada justificación insertada tiene su evento creada", async () => {
  const js = expandirLote(lote({ canal: "coordinacion", registradaPor: s.cuentaId }), enviadaEn);
  const guardadas = await enTx(bd, tx => repo.insertarLote(tx, js, s.cuentaId));
  expect(guardadas.map(j => ({ ...j }))).toEqual(js.map(j => ({ ...j, enviadaEn, registradaEn: enviadaEn })));
  const eventos = await bd.app.query("SELECT justificacion_id,tipo,por FROM justificacion_evento WHERE justificacion_id=ANY($1::uuid[]) ORDER BY secuencia", [js.map(j => j.id)]);
  expect(eventos.rows).toEqual(js.map(j => ({ justificacion_id: j.id, tipo: "creada", por: s.cuentaId })));
});
