import { randomUUID } from "node:crypto";
import { dejarSinEfecto, revisar } from "@/lib/justificaciones/estados";
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
  const porId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
  expect(porId(guardadas)).toEqual(porId(js.map(j => ({ ...j, enviadaEn, registradaEn: enviadaEn }))));
  const eventos = await bd.app.query("SELECT justificacion_id AS id,tipo,por FROM justificacion_evento WHERE justificacion_id=ANY($1::uuid[])", [js.map(j => j.id)]);
  expect(porId(eventos.rows)).toEqual(porId(js.map(j => ({ id: j.id, tipo: "creada", por: s.cuentaId }))));
});

const tiposEvento = async (id: string) => (await bd.app.query("SELECT tipo,por FROM justificacion_evento WHERE justificacion_id=$1 ORDER BY secuencia", [id])).rows;
const sello = async (id: string) => (await bd.app.query("SELECT actualizado_en FROM justificacion WHERE id=$1", [id])).rows[0].actualizado_en as Date;
/** Cada prueba usa su propia sesión para no cruzarse con otras justificaciones de la misma ausencia. */
async function loteEnSesionNueva(fecha: string) {
  const sesionId = randomUUID();
  await bd.admin.query("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,$3,'misa')", [sesionId, s.cicloId, fecha]);
  const entrada = lote({ ausencias: [{ ...lote().ausencias[0], sesionId, fecha }] });
  const [j] = await enTx(bd, tx => repo.insertarLote(tx, expandirLote(entrada, enviadaEn), s.cuentaId));
  return { j, ausencia: { catequizandoId: s.catequizandoId, sesionId } };
}

test("RF-408: revisar guarda revisada_por, revisada_en y su evento", async () => {
  const { j } = await loteEnSesionNueva("2026-10-25");
  const antes = await sello(j.id);
  const revisada = revisar(j, "rechazada", s.cuentaId, "2026-11-03T15:00:00.000Z", "Foto ilegible");
  await enTx(bd, tx => repo.guardarRevision(tx, revisada));
  expect(await enTx(bd, tx => repo.obtener(tx, j.id))).toEqual(revisada);
  expect((await sello(j.id)).getTime()).toBeGreaterThan(antes.getTime());
  expect(await tiposEvento(j.id)).toEqual([{ tipo: "creada", por: s.cuentaId }, { tipo: "rechazada", por: s.cuentaId }]);
  await expect(enTx(bd, tx => repo.guardarRevision(tx, revisar(j, "aprobada", s.cuentaId, "2026-11-03T16:00:00.000Z")))).rejects.toThrow("no_pendiente");
});

test("RF-407: marcar sin efecto conserva la fila y registra el evento sin_efecto", async () => {
  const { j, ausencia } = await loteEnSesionNueva("2026-11-08");
  const antes = await sello(j.id);
  const en = new Date("2026-11-09T14:00:00.000Z");
  expect(await enTx(bd, tx => repo.marcarSinEfecto(tx, ausencia, en))).toEqual([j.id]);
  expect(await enTx(bd, tx => repo.marcarSinEfecto(tx, ausencia, en))).toEqual([]);
  expect(await enTx(bd, tx => repo.obtener(tx, j.id))).toEqual(dejarSinEfecto(j, en.toISOString()));
  expect((await sello(j.id)).getTime()).toBeGreaterThan(antes.getTime());
  expect(await tiposEvento(j.id)).toEqual([{ tipo: "creada", por: s.cuentaId }, { tipo: "sin_efecto", por: null }]);
  await expect(enTx(bd, tx => repo.guardarRevision(tx, revisar(j, "aprobada", s.cuentaId, "2026-11-10T16:00:00.000Z")))).rejects.toThrow("no_pendiente");
});

test("RF-407: restaurar registra efecto_restaurado", async () => {
  const { j, ausencia } = await loteEnSesionNueva("2026-11-15");
  await enTx(bd, tx => repo.marcarSinEfecto(tx, ausencia, new Date("2026-11-16T14:00:00.000Z")));
  const antes = await sello(j.id);
  expect(await enTx(bd, tx => repo.restaurarEfecto(tx, ausencia))).toEqual([j.id]);
  expect(await enTx(bd, tx => repo.obtener(tx, j.id))).toEqual(j);
  expect((await sello(j.id)).getTime()).toBeGreaterThan(antes.getTime());
  expect((await tiposEvento(j.id)).map(e => e.tipo)).toEqual(["creada", "sin_efecto", "efecto_restaurado"]);
});

test("RF-408: las pendientes del ciclo salen agrupadas por lote", async () => {
  const conjunto = expandirLote(lote(), enviadaEn);
  await enTx(bd, tx => repo.insertarLote(tx, conjunto, s.cuentaId));
  const { j: revisada } = await loteEnSesionNueva("2026-10-18");
  await enTx(bd, tx => repo.guardarRevision(tx, revisar(revisada, "aprobada", s.cuentaId, "2026-11-03T15:00:00.000Z")));
  const lotes = await enTx(bd, tx => repo.bandeja(tx, s.cicloId));
  const delConjunto = lotes.find(l => l.loteId === conjunto[0].loteId);
  expect(delConjunto?.justificaciones.map(j => j.catequizandoId).sort()).toEqual([s.catequizandoId, s.hermanoId].sort());
  expect(lotes.some(l => l.loteId === revisada.loteId)).toBe(false);
  expect(lotes.flatMap(l => l.justificaciones).every(j => j.estadoRevision === "pendiente" && !j.sinEfectoDesde)).toBe(true);
  expect(new Set(lotes.map(l => l.loteId)).size).toBe(lotes.length);
});

test("RF-408: la consulta marca las ausencias con más de una justificación", async () => {
  const { j: unica } = await loteEnSesionNueva("2026-10-11");
  const { j: primera, ausencia } = await loteEnSesionNueva("2026-10-04");
  const segundaEntrada = lote({ ausencias: [{ ...lote().ausencias[0], ...ausencia, fecha: "2026-10-04" }] });
  const [segunda] = await enTx(bd, tx => repo.insertarLote(tx, expandirLote(segundaEntrada, enviadaEn), s.cuentaId));
  const marcas = new Map((await enTx(bd, tx => repo.bandeja(tx, s.cicloId))).flatMap(l => l.justificaciones).map(j => [j.id, j.duplicada]));
  expect(marcas.get(unica.id)).toBe(false);
  expect(marcas.get(primera.id)).toBe(true);
  expect(marcas.get(segunda.id)).toBe(true);
});

test("RF-410: listarPorApoderado devuelve solo las de sus hijos", async () => {
  const [otroApoderado, otroNino, otraEvidencia] = [randomUUID(), randomUUID(), randomUUID()];
  await bd.admin.query("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto) VALUES($1,'Otro','Adulto','otro','prueba')", [otroApoderado]);
  await bd.admin.query("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,'Luis','Prueba','2015-01-01','masculino',true,$2)", [otroNino, s.cuentaId]);
  await bd.admin.query("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion) VALUES($1,$2,$3,'padre')", [randomUUID(), otroNino, otroApoderado]);
  await bd.admin.query("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [otraEvidencia, s.cicloId, s.cuentaId]);
  const ajena = expandirLote(lote({ apoderadoId: otroApoderado, evidenciaId: otraEvidencia, ausencias: [{ ...lote().ausencias[0], catequizandoId: otroNino }] }), enviadaEn);
  await enTx(bd, tx => repo.insertarLote(tx, ajena, s.cuentaId));
  const propias = await enTx(bd, tx => repo.listarPorApoderado(tx, s.apoderadoId));
  expect(propias.length).toBeGreaterThan(0);
  expect(propias.every(j => [s.catequizandoId, s.hermanoId].includes(j.catequizandoId))).toBe(true);
  expect((await enTx(bd, tx => repo.listarPorApoderado(tx, otroApoderado))).map(j => j.id)).toEqual(ajena.map(j => j.id));
  expect((await enTx(bd, tx => repo.listarPorCatequizando(tx, otroNino))).map(j => j.id)).toEqual(ajena.map(j => j.id));
});

test("RF-410: cambiosDesde devuelve solo filas con actualizado_en posterior", async () => {
  const desde = (await bd.app.query("SELECT clock_timestamp() AS ahora")).rows[0].ahora as Date;
  const { j, ausencia } = await loteEnSesionNueva("2026-09-27");
  await enTx(bd, tx => repo.marcarSinEfecto(tx, ausencia, new Date("2026-11-04T15:00:00.000Z")));
  const cambios = await enTx(bd, tx => repo.cambiosDesde(tx, desde));
  expect(cambios).toEqual([{ id: j.id, catequizandoId: s.catequizandoId, sesionId: ausencia.sesionId, fecha: "2026-09-27", tipoSesion: "misa", estadoVisible: "sin_efecto", actualizadoEn: expect.any(String) }]);
  expect(Object.keys(cambios[0])).not.toEqual(expect.arrayContaining(["causa"]));
  expect(await enTx(bd, tx => repo.cambiosDesde(tx, desde, [s.hermanoId]))).toEqual([]);
  // El cursor en milisegundos puede reentregar la última fila (microsegundos en PostgreSQL); el pull es idempotente.
  expect(await enTx(bd, tx => repo.cambiosDesde(tx, new Date(Date.parse(cambios[0].actualizadoEn) + 1)))).toEqual([]);
});
