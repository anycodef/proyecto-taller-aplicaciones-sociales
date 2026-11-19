import { randomUUID } from "node:crypto";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../src/compartido/bd/transaccion";
import { alCambiarAsistencia } from "../../../src/modulos/justificaciones/aplicacion/al-cambiar-asistencia";
import { consultaJustificaciones } from "../../../src/modulos/justificaciones/aplicacion/consulta-justificaciones";
import { revisarJustificaciones } from "../../../src/modulos/justificaciones/aplicacion/coordinacion";
import { registrarAlCambiarJustificacion } from "../../../src/modulos/justificaciones/dominio/puertos";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
let evidenciaId: string;
let ctx: ContextoAcceso;
const retiros: (() => void)[] = [];
const q = (texto: string, valores: unknown[] = []) => bd.admin.query(texto, valores);

beforeAll(async () => {
  bd = await prepararBd("notif004");
  s = await sembrar(bd);
  evidenciaId = randomUUID();
  await q("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidenciaId, s.cicloId, s.cuentaId]);
  ctx = { cuentaId: s.cuentaId, credencialId: randomUUID(), rolesPropios: ["coordinacion"], gruposAsignados: [], catequizandosApoderados: [], identidadOperativa: "Coordinación 1", esMenor: false };
});
afterEach(() => { while (retiros.length) retiros.pop()!(); });
afterAll(async () => { await bd?.cerrar(); });

async function pendiente(sesionId = s.sesionId): Promise<string> {
  const id = randomUUID();
  await q(`INSERT INTO justificacion(id,lote_id,ciclo_id,catequizando_id,sesion_id,tipo_sesion,fecha_sesion,causa,evidencia_id,enviada_por,canal)
    VALUES($1,$2,$3,$4,$5,'misa','2026-11-01','salud_nino',$6,$7,'enlace')`, [id, randomUUID(), s.cicloId, s.catequizandoId, sesionId, evidenciaId, s.apoderadoId]);
  return id;
}
/** Cada suscriptor lee dentro de la transacción que recibe: así se comprueba que corre en proceso y antes del commit. */
function suscribir(nombre: string, registro: { nombre: string; ids: string[]; visto: string | null }[]) {
  retiros.push(registrarAlCambiarJustificacion(async ({ justificaciones }, tx: Tx) => {
    const fila = await tx.query<{ estado: string }>("SELECT CASE WHEN sin_efecto_desde IS NOT NULL THEN 'sin_efecto' ELSE estado_revision END AS estado FROM justificacion WHERE id=$1", [justificaciones[0]!.id]);
    registro.push({ nombre, ids: justificaciones.map(j => j.id), visto: fila.rows[0]?.estado ?? null });
  }));
}

test("RF-409: aprobar o dejar sin efecto notifica a los suscriptores en proceso", async () => {
  const registro: { nombre: string; ids: string[]; visto: string | null }[] = [];
  suscribir("aptitud", registro);
  suscribir("riesgo", registro);
  const id = await pendiente();
  await enTx(bd, tx => revisarJustificaciones({ ids: [id], decision: "aprobada" }, ctx, new Date(), tx));
  expect(registro).toEqual([{ nombre: "aptitud", ids: [id], visto: "aprobada" }, { nombre: "riesgo", ids: [id], visto: "aprobada" }]);

  registro.length = 0;
  await q(`INSERT INTO asistencia(id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,hora_primer_registro,recibido_primer_registro,corregida,conflicto)
    VALUES($1,$2,$3,$4,'presente','manual','2026-11-01T15:00:00Z','2026-11-01T15:00:00Z',true,false)`, [randomUUID(), s.cicloId, s.sesionId, s.catequizandoId]);
  await enTx(bd, tx => alCambiarAsistencia({ cicloId: s.cicloId, catequizandoId: s.catequizandoId, fecha: "2026-11-01" }, tx));
  expect(registro.map(r => r.nombre)).toEqual(["aptitud", "riesgo"]);
  expect(registro.every(r => r.ids.includes(id) && r.visto === "sin_efecto")).toBe(true);
  await q("DELETE FROM asistencia WHERE sesion_id=$1 AND catequizando_id=$2", [s.sesionId, s.catequizandoId]);
  await enTx(bd, tx => alCambiarAsistencia({ cicloId: s.cicloId, catequizandoId: s.catequizandoId, fecha: "2026-11-01" }, tx));
});

test("RF-409: si un suscriptor falla la revisión se revierte", async () => {
  retiros.push(registrarAlCambiarJustificacion(async () => { throw new Error("suscriptor_caido"); }));
  const id = await pendiente(s.sesion2Id);
  await expect(enTx(bd, tx => revisarJustificaciones({ ids: [id], decision: "aprobada" }, ctx, new Date(), tx))).rejects.toThrow("suscriptor_caido");
  expect((await q("SELECT estado_revision FROM justificacion WHERE id=$1", [id])).rows[0].estado_revision).toBe("pendiente");
});

test("RF-409: una ausencia a misa aprobada queda justificada para la aptitud de 006", async () => {
  const id = await pendiente();
  await enTx(bd, tx => revisarJustificaciones({ ids: [id], decision: "aprobada" }, ctx, new Date(), tx));
  await enTx(bd, async tx => {
    expect(await consultaJustificaciones.ausenciaMisaJustificada(s.cicloId, { catequizandoId: s.catequizandoId, sesionId: s.sesionId }, tx)).toBe(true);
  });
});
