import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { expandirLote } from "@/lib/justificaciones/lote";
import { participanteRetencionJustificaciones as participante } from "../../../src/modulos/justificaciones/aplicacion/depurar-evidencias";
import { nombreBlob } from "../../../src/modulos/justificaciones/dominio/puertos";
import { repositorioEvidenciasPg } from "../../../src/modulos/justificaciones/infraestructura/repositorio-evidencias-pg";
import { repositorioJustificacionesPg } from "../../../src/modulos/justificaciones/infraestructura/repositorio-justificaciones-pg";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
beforeAll(async () => { bd = await prepararBd("ret004"); s = await sembrar(bd); });
afterAll(async () => { await bd?.cerrar(); });

const ahora = new Date("2026-11-04T15:00:00Z");

/** Una evidencia confirmada que justifica a los dos hermanos el mismo domingo. */
async function loteDeHermanos(): Promise<{ evidenciaId: string; ids: string[] }> {
  const evidenciaId = randomUUID();
  const archivo = { orden: 1, blobNombre: nombreBlob(s.cicloId, evidenciaId, 1), bytes: 1000, contentType: "image/jpeg" };
  const js = expandirLote({
    loteId: randomUUID(), cicloId: s.cicloId, causa: "salud_nino", evidenciaId, cantidadFotos: 1, apoderadoId: s.apoderadoId, canal: "enlace",
    ausencias: [s.catequizandoId, s.hermanoId].map(catequizandoId => ({ catequizandoId, sesionId: s.sesionId, tipoSesion: "misa" as const, fecha: "2026-11-01", justificacionId: randomUUID(), anticipada: false })),
  }, ahora.toISOString());
  await enTx(bd, async tx => {
    await repositorioEvidenciasPg.reservar(tx, { id: evidenciaId, cicloId: s.cicloId, subidaPor: s.cuentaId, en: ahora });
    await repositorioEvidenciasPg.confirmar(tx, evidenciaId, [archivo], ahora);
    await repositorioJustificacionesPg.insertarLote(tx, js, s.cuentaId);
  });
  return { evidenciaId, ids: js.map(j => j.id) };
}

async function enRetencion<T>(contexto: "retiro_consentimiento" | "retencion", operacion: (tx: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await bd.admin.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET LOCAL ROLE sigecat_retencion");
    await cliente.query("SELECT set_config('sigecat.contexto',$1,true)", [contexto]);
    const resultado = await operacion(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) { await cliente.query("ROLLBACK"); throw error; } finally { cliente.release(); }
}

test("RF-407: al retirar el consentimiento de un hermano se elimina la evidencia compartida", async () => {
  const { evidenciaId, ids: [propia, delHermano] } = await loteDeHermanos();
  const resultado = await enRetencion("retiro_consentimiento", tx => participante.alRetirarConsentimiento(s.catequizandoId, tx));
  expect(resultado.blobs).toEqual([{ contenedor: "evidencias", ruta: nombreBlob(s.cicloId, evidenciaId, 1) }]);
  expect(resultado.cantidad).toBeGreaterThanOrEqual(1);
  expect((await bd.app.query("SELECT estado,motivo_eliminacion FROM evidencia WHERE id=$1", [evidenciaId])).rows[0]).toEqual({ estado: "eliminada", motivo_eliminacion: "consentimiento" });
  expect((await bd.app.query("SELECT count(*)::int AS n FROM justificacion WHERE id=$1", [propia])).rows[0].n).toBe(0);
  expect((await bd.app.query("SELECT count(*)::int AS n FROM justificacion WHERE id=$1", [delHermano])).rows[0].n).toBe(1);
});

test("RF-407: queda el evento evidencia_eliminada con su motivo", async () => {
  const { ids: [, delHermano] } = await loteDeHermanos();
  await enRetencion("retiro_consentimiento", tx => participante.alRetirarConsentimiento(s.catequizandoId, tx));
  const eventos = await bd.app.query("SELECT tipo,por,detalle FROM justificacion_evento WHERE justificacion_id=$1 ORDER BY secuencia", [delHermano]);
  expect(eventos.rows).toEqual([
    { tipo: "creada", por: s.cuentaId, detalle: expect.any(Object) },
    { tipo: "evidencia_eliminada", por: null, detalle: { motivo: "consentimiento" } },
  ]);
});

test("RF-407: fuera del contexto de retención el participante no actúa", async () => {
  await expect(enTx(bd, tx => participante.alRetirarConsentimiento(s.hermanoId, tx))).rejects.toMatchObject({ estado: 403 });
});

test("RF-407: al vencer la retención del ciclo se borran justificaciones y evidencias y se entregan sus blobs", async () => {
  const { evidenciaId } = await loteDeHermanos();
  const resultado = await enRetencion("retencion", tx => participante.alVencerCiclo(s.cicloId, tx));
  expect(resultado.blobs).toEqual(expect.arrayContaining([{ contenedor: "evidencias", ruta: nombreBlob(s.cicloId, evidenciaId, 1) }]));
  for (const tabla of ["justificacion", "evidencia"]) expect((await bd.app.query(`SELECT count(*)::int AS n FROM ${tabla} WHERE ciclo_id=$1`, [s.cicloId])).rows[0].n).toBe(0);
});
