import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { consolidarPar } from "../../../src/modulos/asistencia/aplicacion/procesar-marcas";
import { registrarAlCambiarAsistencia } from "../../../src/modulos/asistencia/dominio/puertos";
import { alCambiarAsistencia } from "../../../src/modulos/justificaciones/aplicacion/al-cambiar-asistencia";
import { registrarAlCambiarJustificacion } from "../../../src/modulos/justificaciones/dominio/puertos";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
let justificacionId: string;
const notificadas: string[][] = [];

beforeAll(async () => {
  bd = await prepararBd("alcambio004");
  s = await sembrar(bd);
  const evidenciaId = randomUUID();
  justificacionId = randomUUID();
  await bd.app.query("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidenciaId, s.cicloId, s.cuentaId]);
  await bd.app.query(`INSERT INTO justificacion(id,lote_id,ciclo_id,catequizando_id,sesion_id,tipo_sesion,fecha_sesion,causa,evidencia_id,enviada_por,canal)
    VALUES($1,$2,$3,$4,$5,'misa','2026-11-01','salud_nino',$6,$7,'enlace')`, [justificacionId, randomUUID(), s.cicloId, s.catequizandoId, s.sesionId, evidenciaId, s.apoderadoId]);
  registrarAlCambiarAsistencia(alCambiarAsistencia);
  registrarAlCambiarJustificacion(async ({ justificaciones }) => { notificadas.push(justificaciones.map(j => j.id)); });
});
afterAll(async () => {
  registrarAlCambiarJustificacion(async () => undefined);
  await bd?.cerrar();
});

let segundos = 0;
async function corregir(tx: PoolClient, anterior: "presente" | "ausente", nuevo: "presente" | "ausente"): Promise<void> {
  segundos += 1;
  await tx.query(`INSERT INTO correccion_asistencia(id,ciclo_id,sesion_id,catequizando_id,valor_anterior,valor_nuevo,corregido_por,hora_dispositivo,desfase_reloj_ms,recibido_en,estado,huella_peticion)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$8,'aceptada','prueba')`, [randomUUID(), s.cicloId, s.sesionId, s.catequizandoId, anterior, nuevo, s.cuentaId, new Date(Date.UTC(2026, 10, 1, 15, 0, segundos))]);
  await consolidarPar(s.sesionId, s.catequizandoId, tx);
}
const estado = async () => (await bd.admin.query<{ sin_efecto_desde: Date | null; estado_revision: string }>("SELECT sin_efecto_desde,estado_revision FROM justificacion WHERE id=$1", [justificacionId])).rows[0];
const eventos = async () => (await bd.admin.query<{ tipo: string }>("SELECT tipo FROM justificacion_evento WHERE justificacion_id=$1 ORDER BY secuencia", [justificacionId])).rows.map(f => f.tipo);

test("RF-407: la corrección de 003 llama al puerto dentro de su transacción", async () => {
  const cliente = await bd.app.connect();
  try {
    await cliente.query("BEGIN");
    await corregir(cliente, "ausente", "presente");
    expect((await cliente.query("SELECT sin_efecto_desde FROM justificacion WHERE id=$1", [justificacionId])).rows[0].sin_efecto_desde).not.toBeNull();
    await cliente.query("ROLLBACK");
  } finally { cliente.release(); }
  expect((await estado()).sin_efecto_desde).toBeNull();
  notificadas.length = 0;
});

test("RF-407: una ausencia corregida a presente queda sin efecto y se conserva", async () => {
  await enTx(bd, tx => corregir(tx, "ausente", "presente"));
  const fila = await estado();
  expect(fila.sin_efecto_desde).not.toBeNull();
  expect(fila.estado_revision).toBe("pendiente");
  expect(await eventos()).toContain("sin_efecto");
  expect(notificadas).toEqual([[justificacionId]]);
});

test("RF-407: si vuelve a ausente se restaura el efecto", async () => {
  await enTx(bd, tx => corregir(tx, "presente", "ausente"));
  expect((await estado()).sin_efecto_desde).toBeNull();
  expect(await eventos()).toContain("efecto_restaurado");
  expect(notificadas.at(-1)).toEqual([justificacionId]);
});
