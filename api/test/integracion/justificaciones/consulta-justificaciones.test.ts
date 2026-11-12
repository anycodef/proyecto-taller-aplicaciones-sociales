import { randomUUID } from "node:crypto";
import { consultarFaltas } from "../../../src/modulos/asistencia/aplicacion/consultar-faltas";
import { fuenteJustificacionesVacia, registrarFuenteJustificaciones } from "../../../src/modulos/asistencia/dominio/puertos";
import { consultaJustificaciones, fuenteJustificacionesAprobadas } from "../../../src/modulos/justificaciones/aplicacion/consulta-justificaciones";
import { enTx, prepararBd, sembrar, type BdPrueba, type Semilla } from "./soporte";

let bd: BdPrueba;
let s: Semilla;
const justificacionId = randomUUID();
const q = (texto: string, valores: unknown[] = []) => bd.admin.query(texto, valores);

beforeAll(async () => {
  bd = await prepararBd("consulta004");
  s = await sembrar(bd);
  const grupo = randomUUID(), consentimiento = randomUUID(), inscripcion = randomUUID(), evidencia = randomUUID();
  await q("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,'Grupo A',8,13,'mixto')", [grupo, s.cicloId]);
  await q("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, s.catequizandoId, s.apoderadoId, s.cuentaId]);
  await q("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,10,false,'prueba','2026-03-02T05:00:00Z')", [inscripcion, s.catequizandoId, s.cicloId, consentimiento]);
  await q("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,'2026-03-02T05:00:00Z')", [randomUUID(), inscripcion, grupo, s.cuentaId]);
  for (const sesion of [s.sesionId, s.sesion2Id]) await q(`INSERT INTO asistencia(id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,hora_primer_registro,recibido_primer_registro,corregida,conflicto)
    VALUES($1,$2,$3,$4,'ausente','manual','2026-11-01T15:00:00Z','2026-11-01T15:00:00Z',false,false)`, [randomUUID(), s.cicloId, sesion, s.catequizandoId]);
  await q("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidencia, s.cicloId, s.cuentaId]);
  await q(`INSERT INTO justificacion(id,lote_id,ciclo_id,catequizando_id,sesion_id,tipo_sesion,fecha_sesion,causa,evidencia_id,enviada_por,canal)
    VALUES($1,$2,$3,$4,$5,'misa','2026-11-01','salud_nino',$6,$7,'enlace')`, [justificacionId, randomUUID(), s.cicloId, s.catequizandoId, s.sesionId, evidencia, s.apoderadoId]);
  registrarFuenteJustificaciones(fuenteJustificacionesAprobadas);
});
afterAll(async () => {
  registrarFuenteJustificaciones(fuenteJustificacionesVacia);
  await bd?.cerrar();
});

const faltas = () => enTx(bd, tx => consultarFaltas(s.cicloId, { catequizandoId: s.catequizandoId, ahora: Date.parse("2026-11-03T12:00:00Z") }, tx));
const aprobar = () => q("UPDATE justificacion SET estado_revision='aprobada',revisada_por=$2,revisada_en=now() WHERE id=$1", [justificacionId, s.cuentaId]);

test("RF-409: con una aprobada de esa fecha faltasDelCiclo marca la falta como justificada", async () => {
  expect(await faltas()).toEqual([expect.objectContaining({ fecha: "2026-11-01", origen: "domingo", justificada: false })]);
  await aprobar();
  expect(await faltas()).toEqual([expect.objectContaining({ fecha: "2026-11-01", origen: "domingo", justificada: true })]);
  await q("UPDATE justificacion SET sin_efecto_desde=now() WHERE id=$1", [justificacionId]);
  expect(await faltas()).toEqual([expect.objectContaining({ justificada: false })]);
  await q("UPDATE justificacion SET sin_efecto_desde=NULL WHERE id=$1", [justificacionId]);
});

test("RF-409: la consulta expone diasPlazo y estadoParaRiesgo", async () => {
  const ausencia = { catequizandoId: s.catequizandoId, fecha: "2026-11-01" };
  await enTx(bd, async tx => {
    expect(await consultaJustificaciones.diasPlazo(s.cicloId, tx)).toBe(7);
    expect(await consultaJustificaciones.venceEn(s.cicloId, "2026-11-01", tx)).toMatch(/^2026-11-08T23:59:59/);
    expect(await consultaJustificaciones.estadoParaRiesgo(s.cicloId, ausencia, tx)).toBe("aprobada");
    expect(await consultaJustificaciones.estadoParaRiesgo(s.cicloId, { ...ausencia, fecha: "2026-11-08" }, tx)).toBe("ninguna");
    expect(await consultaJustificaciones.faltaJustificada(s.cicloId, ausencia, tx)).toBe(true);
    expect(await consultaJustificaciones.ausenciaMisaJustificada(s.cicloId, { catequizandoId: s.catequizandoId, sesionId: s.sesionId }, tx)).toBe(true);
    expect(await consultaJustificaciones.ausenciaMisaJustificada(s.cicloId, { catequizandoId: s.catequizandoId, sesionId: s.sesion2Id }, tx)).toBe(false);
  });
});
