import { randomUUID } from "node:crypto";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { proveedorJustificaciones } from "../../../src/modulos/justificaciones/aplicacion/proveedor-pull";
import { enTx, prepararBd, type BdPrueba } from "./soporte";

let bd: BdPrueba;
const cicloId = randomUUID(), otroCiclo = randomUUID(), grupoA = randomUUID(), grupoB = randomUUID(), cuentaId = randomUUID(), apoderadoId = randomUUID(), sesionId = randomUUID();
const ninos = { a: randomUUID(), b: randomUUID() };
const ids = { a: randomUUID(), b: randomUUID(), otroCiclo: randomUUID() };
const q = (texto: string, valores: unknown[] = []) => bd.admin.query(texto, valores);
const contexto = (roles: ContextoAcceso["rolesPropios"], grupos: string[]): ContextoAcceso => ({
  cuentaId, credencialId: randomUUID(), rolesPropios: roles, gruposAsignados: grupos, catequizandosApoderados: [], identidadOperativa: "Catequista", esMenor: false,
});

const insertar = (id: string, ciclo: string, nino: string, sesion: string, evidencia: string) => q(`INSERT INTO justificacion(id,lote_id,ciclo_id,catequizando_id,sesion_id,tipo_sesion,fecha_sesion,causa,evidencia_id,enviada_por,canal)
  VALUES($1,$2,$3,$4,$5,'misa','2026-11-08','salud_nino',$6,$7,'enlace')`, [id, randomUUID(), ciclo, nino, sesion, evidencia, apoderadoId]);

beforeAll(async () => {
  bd = await prepararBd("pull004");
  await q("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Coordinación pull',false)", [cuentaId]);
  await q("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto) VALUES($1,'Adulto','Prueba','otro','prueba')", [apoderadoId]);
  for (const nino of [ninos.a, ninos.b]) await q("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,creado_por) VALUES($1,'Niño','Prueba','2016-01-01','femenino',true,$2)", [nino, cuentaId]);
  // Solo puede haber un ciclo abierto: el anterior se llena y se cierra antes de abrir el actual.
  const sesionAnterior = randomUUID(), evidenciaAnterior = randomUUID();
  await q("INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,'Ciclo anterior','2026-01-01','2026-12-31',$2)", [otroCiclo, cuentaId]);
  await q("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,'2026-11-08','misa')", [sesionAnterior, otroCiclo]);
  await q("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidenciaAnterior, otroCiclo, cuentaId]);
  await insertar(ids.otroCiclo, otroCiclo, ninos.a, sesionAnterior, evidenciaAnterior);
  await q("UPDATE ciclo SET estado='cerrado',cerrado_por=$2,cerrado_en=now() WHERE id=$1", [otroCiclo, cuentaId]);
  await q("INSERT INTO ciclo(id,nombre,inicio,fin,abierto_por) VALUES($1,'Ciclo pull','2026-01-01','2026-12-31',$2)", [cicloId, cuentaId]);
  await q("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$3,'Grupo A',8,13,'mixto'),($2,$3,'Grupo B',8,13,'mixto')", [grupoA, grupoB, cicloId]);
  for (const [nino, grupo] of [[ninos.a, grupoA], [ninos.b, grupoB]]) {
    const consentimiento = randomUUID(), inscripcion = randomUUID();
    await q("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,'00100000-0000-4000-8000-000000000001','presencial',$4)", [consentimiento, nino, apoderadoId, cuentaId]);
    await q("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,huella_peticion,desde) VALUES($1,$2,$3,$4,10,false,'prueba','2026-01-02T05:00:00Z')", [inscripcion, nino, cicloId, consentimiento]);
    await q("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,desde) VALUES($1,$2,$3,$4,false,'2026-01-02T05:00:00Z')", [randomUUID(), inscripcion, grupo, cuentaId]);
  }
  const evidencia = randomUUID();
  await q("INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,'2026-11-08','misa')", [sesionId, cicloId]);
  await q("INSERT INTO evidencia(id,ciclo_id,subida_por) VALUES($1,$2,$3)", [evidencia, cicloId, cuentaId]);
  await insertar(ids.a, cicloId, ninos.a, sesionId, evidencia);
  await insertar(ids.b, cicloId, ninos.b, sesionId, evidencia);
  await q("UPDATE justificacion SET sin_efecto_desde=now() WHERE id=$1", [ids.b]);
});
afterAll(async () => { await bd?.cerrar(); });

const pull = (ctx: ContextoAcceso, desde: number | null = null) => enTx(bd, tx => proveedorJustificaciones.pull({ cuenta: ctx, cicloId, desde, hasta: Date.now() + 1000 }, tx));

test("RF-410: el catequista recibe solo los estados de sus grupos", async () => {
  const { justificaciones_estado: cambios } = await pull(contexto(["catequista"], [grupoA]));
  expect(cambios.created.map(f => f.id)).toEqual([ids.a]);
  expect(cambios.deleted).toEqual([]);
});

test("RF-410: la coordinación recibe todos los del ciclo", async () => {
  const { justificaciones_estado: cambios } = await pull(contexto(["coordinacion"], []));
  expect(cambios.created.map(f => f.id).sort()).toEqual([ids.a, ids.b].sort());
  expect(cambios.created.find(f => f.id === ids.b)?.estado).toBe("sin_efecto");
  expect((await pull(contexto(["coordinacion"], []), Date.now() + 500)).justificaciones_estado.created).toEqual([]);
});

test("RF-410: el pull solo envía id, niño, sesión, fecha, tipo y estado visible", async () => {
  const { justificaciones_estado: cambios } = await pull(contexto(["coordinacion"], []));
  for (const fila of cambios.created) expect(Object.keys(fila).sort()).toEqual(["catequizando_id", "estado", "fecha", "id", "sesion_id", "tipo_sesion"]);
  expect(cambios.created.find(f => f.id === ids.a)).toEqual({ id: ids.a, catequizando_id: ninos.a, sesion_id: sesionId, fecha: "2026-11-08", tipo_sesion: "misa", estado: "pendiente" });
});
