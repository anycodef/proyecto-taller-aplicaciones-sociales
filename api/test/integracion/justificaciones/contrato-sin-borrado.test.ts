import { randomUUID } from "node:crypto";
import { prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
beforeAll(async () => { bd = await prepararBd("borr004"); s = await sembrar(bd); });
afterAll(async () => { await bd?.cerrar(); });

async function crear(): Promise<{ evidenciaId: string; justificacionId: string }> {
  const evidenciaId = randomUUID(), justificacionId = randomUUID();
  await bd.app.query("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidenciaId, s.cicloId, s.cuentaId]);
  await bd.app.query("INSERT INTO evidencia_archivo(evidencia_id,orden,blob_nombre,bytes,content_type) VALUES($1,1,$2,100,'image/jpeg')", [evidenciaId, `${s.cicloId}/${evidenciaId}/1.jpg`]);
  await bd.app.query(`INSERT INTO justificacion(id,lote_id,ciclo_id,catequizando_id,sesion_id,tipo_sesion,fecha_sesion,causa,evidencia_id,enviada_por,canal)
    VALUES($1,$2,$3,$4,$5,'misa','2026-11-01','salud_nino',$6,$7,'enlace')`, [justificacionId, randomUUID(), s.cicloId, s.catequizandoId, s.sesionId, evidenciaId, s.apoderadoId]);
  await bd.app.query("INSERT INTO justificacion_evento(justificacion_id,tipo,por) VALUES($1,'creada',$2)", [justificacionId, s.cuentaId]);
  return { evidenciaId, justificacionId };
}

test("RF-407: borrar una justificación falla por trigger", async () => {
  const { justificacionId } = await crear();
  await expect(bd.admin.query("DELETE FROM justificacion WHERE id=$1", [justificacionId])).rejects.toMatchObject({ code: "SG401" });
});

test("RF-407: borrar un evento o una evidencia falla", async () => {
  const { evidenciaId, justificacionId } = await crear();
  await expect(bd.admin.query("DELETE FROM justificacion_evento WHERE justificacion_id=$1", [justificacionId])).rejects.toMatchObject({ code: "42501" });
  await expect(bd.admin.query("DELETE FROM evidencia_archivo WHERE evidencia_id=$1", [evidenciaId])).rejects.toMatchObject({ code: "SG401" });
  await expect(bd.admin.query("DELETE FROM evidencia WHERE id=$1", [evidenciaId])).rejects.toMatchObject({ code: "SG401" });
});

test("RF-407: el rol de la aplicación no tiene DELETE", async () => {
  const { evidenciaId, justificacionId } = await crear();
  for (const [tabla, columna, id] of [["justificacion", "id", justificacionId], ["justificacion_evento", "justificacion_id", justificacionId], ["evidencia", "id", evidenciaId], ["evidencia_archivo", "evidencia_id", evidenciaId]]) {
    await expect(bd.app.query(`DELETE FROM ${tabla} WHERE ${columna}=$1`, [id])).rejects.toMatchObject({ code: "42501" });
  }
});

test("RF-407: una evidencia solo pasa a eliminada mediante marcar_evidencia_eliminada con motivo", async () => {
  const { evidenciaId } = await crear();
  await expect(bd.app.query("UPDATE evidencia SET estado='eliminada',eliminada_en=now(),motivo_eliminacion='huerfana' WHERE id=$1", [evidenciaId])).rejects.toMatchObject({ code: "SG402" });
  await expect(bd.app.query("SELECT marcar_evidencia_eliminada($1,'otro')", [evidenciaId])).rejects.toMatchObject({ code: "22023" });
  expect((await bd.app.query("SELECT marcar_evidencia_eliminada($1,'consentimiento') AS hecho", [evidenciaId])).rows[0].hecho).toBe(true);
  expect((await bd.app.query("SELECT marcar_evidencia_eliminada($1,'consentimiento') AS hecho", [evidenciaId])).rows[0].hecho).toBe(false);
  expect((await bd.app.query("SELECT estado,motivo_eliminacion FROM evidencia WHERE id=$1", [evidenciaId])).rows[0]).toEqual({ estado: "eliminada", motivo_eliminacion: "consentimiento" });
  await expect(bd.app.query("UPDATE evidencia SET estado='confirmada',confirmada_en=now() WHERE id=$1", [evidenciaId])).rejects.toMatchObject({ code: "SG402" });
});

test("RF-407: el contexto de retención sí puede borrar", async () => {
  const { evidenciaId, justificacionId } = await crear();
  const cliente = await bd.admin.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET LOCAL ROLE sigecat_retencion");
    await cliente.query("SELECT set_config('sigecat.contexto','retiro_consentimiento',true)");
    await cliente.query("DELETE FROM justificacion_evento WHERE justificacion_id=$1", [justificacionId]);
    await cliente.query("DELETE FROM justificacion WHERE id=$1", [justificacionId]);
    await cliente.query("DELETE FROM evidencia_archivo WHERE evidencia_id=$1", [evidenciaId]);
    await expect(cliente.query("DELETE FROM evidencia WHERE id=$1", [evidenciaId])).resolves.toMatchObject({ rowCount: 1 });
  } finally { await cliente.query("ROLLBACK"); cliente.release(); }
});
