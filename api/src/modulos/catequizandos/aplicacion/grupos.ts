import type { z } from "zod";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { modalidadHabitual } from "@/lib/catequizandos/grupos";
import { edadEnFecha } from "@/lib/catequizandos/edad";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearNino, cambio, cicloAbierto } from "../infraestructura/comun";
import type * as esquemas from "../http/esquemas";
export async function crearGrupo(tx: Tx, datos: z.infer<typeof esquemas.grupo>) {
  await cicloAbierto(tx, datos.cicloId);
  const r = await tx.query("INSERT INTO grupo(id,ciclo_id,nombre,edad_minima,edad_maxima,modalidad) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING id", [datos.id, datos.cicloId, datos.nombre, datos.edadMinima, datos.edadMaxima, datos.modalidad]);
  if (!r.rowCount && !(await tx.query("SELECT id FROM grupo WHERE id=$1 AND ciclo_id=$2 AND nombre=$3 AND edad_minima=$4 AND edad_maxima=$5 AND modalidad=$6", [datos.id, datos.cicloId, datos.nombre, datos.edadMinima, datos.edadMaxima, datos.modalidad])).rowCount) throw new ErrorAplicacion(409, "uuid_en_conflicto");
  return { estado: r.rowCount ? 201 : 200, datos: { grupoId: datos.id } };
}
async function bloquearGrupo(tx: Tx, id: string) {
  const r = await tx.query<{ ciclo_id: string; edad_minima: number; edad_maxima: number; estado: string }>("SELECT ciclo_id,edad_minima,edad_maxima,estado FROM grupo WHERE id=$1 FOR UPDATE", [id]);
  if (!r.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  await cicloAbierto(tx, r.rows[0].ciclo_id);
  return r.rows[0];
}
export async function editarGrupo(tx: Tx, id: string, datos: z.infer<typeof esquemas.editarGrupo>) {
  const g = await bloquearGrupo(tx, id);
  if (g.estado !== "abierto") throw new ErrorAplicacion(409, "grupo_cerrado");
  if ((datos.edadMinima ?? g.edad_minima) > (datos.edadMaxima ?? g.edad_maxima)) throw new ErrorAplicacion(422, "rango_invalido");
  await tx.query("UPDATE grupo SET nombre=COALESCE($2,nombre),edad_minima=COALESCE($3,edad_minima),edad_maxima=COALESCE($4,edad_maxima),modalidad=COALESCE($5,modalidad),actualizado_en=clock_timestamp() WHERE id=$1", [id, datos.nombre ?? null, datos.edadMinima ?? null, datos.edadMaxima ?? null, datos.modalidad ?? null]);
  return { grupoId: id };
}
export async function cerrarGrupo(tx: Tx, id: string) {
  await bloquearGrupo(tx, id);
  if ((await tx.query("SELECT catequizando_id FROM v_nomina_ciclo WHERE grupo_id=$1 LIMIT 1", [id])).rowCount) throw new ErrorAplicacion(409, "grupo_con_ninos_activos");
  await tx.query("UPDATE grupo SET estado='cerrado',cerrado_en=COALESCE(cerrado_en,clock_timestamp()),actualizado_en=clock_timestamp() WHERE id=$1", [id]);
  await tx.query("UPDATE grupo_catequista SET hasta=clock_timestamp() WHERE grupo_id=$1 AND hasta IS NULL", [id]);
  return { grupoId: id, estado: "cerrado" };
}
export async function asignarCatequistas(tx: Tx, id: string, datos: z.infer<typeof esquemas.catequistas>) {
  const g = await bloquearGrupo(tx, id);
  if (g.estado !== "abierto") throw new ErrorAplicacion(409, "grupo_cerrado");
  for (const a of datos.asignaciones) {
    if (!(await tx.query("SELECT c.id FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id WHERE c.id=$1 AND c.activa AND r.rol='catequista' FOR SHARE OF c", [a.cuentaId])).rowCount) throw new ErrorAplicacion(422, "cuenta_no_catequista");
    const previo = await tx.query("SELECT id FROM grupo_catequista WHERE id=$1 AND grupo_id=$2 AND cuenta_id=$3 AND hasta IS NULL", [a.id, id, a.cuentaId]);
    if (!previo.rowCount && (await tx.query("SELECT id FROM grupo_catequista WHERE id=$1", [a.id])).rowCount) throw new ErrorAplicacion(409, "uuid_en_conflicto");
  }
  await tx.query("UPDATE grupo_catequista SET hasta=clock_timestamp() WHERE grupo_id=$1 AND hasta IS NULL AND NOT(id=ANY($2::uuid[]))", [id, datos.asignaciones.map(a => a.id)]);
  for (const a of datos.asignaciones) await tx.query("INSERT INTO grupo_catequista(id,grupo_id,cuenta_id) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING", [a.id, id, a.cuentaId]);
  await tx.query("UPDATE grupo SET actualizado_en=clock_timestamp() WHERE id=$1", [id]);
  return { grupoId: id, sinCatequista: datos.asignaciones.length === 0 };
}
export async function listarGrupos(tx: Tx, cicloId: string, contexto: ContextoAcceso, sugerencia?: z.infer<typeof esquemas.sugerencia>) {
  const coord = contexto.rolesPropios.includes("coordinacion") || Boolean(contexto.delegacionVigente);
  const r = await tx.query<{ id: string; edadMinima: number; edadMaxima: number; modalidad: string; estado: string }>(`SELECT g.id,g.nombre,g.ciclo_id AS "cicloId",g.edad_minima AS "edadMinima",g.edad_maxima AS "edadMaxima",g.modalidad,g.estado,
    (SELECT count(*)::int FROM v_nomina_ciclo n WHERE n.grupo_id=g.id) AS total,
    NOT EXISTS(SELECT 1 FROM grupo_catequista gc JOIN cuenta c ON c.id=gc.cuenta_id WHERE gc.grupo_id=g.id AND gc.hasta IS NULL AND c.activa) AS "sinCatequista"
    FROM grupo g WHERE g.ciclo_id=$1 AND ($2 OR g.id=ANY($3::uuid[])) ORDER BY g.nombre,g.id`, [cicloId, coord, contexto.gruposAsignados]);
  if (!sugerencia) return r.rows;
  const ciclo = await cicloAbierto(tx, cicloId);
  let edad: number;
  try { edad = edadEnFecha(sugerencia.fechaNacimiento, ciclo.inicio); } catch { throw new ErrorAplicacion(422, "fecha_invalida"); }
  const candidatos = r.rows.filter(g => g.estado === "abierto" && g.edadMinima <= edad && edad <= g.edadMaxima && g.modalidad === modalidadHabitual(edad, sugerencia.sexo));
  const conteos = await tx.query<{ grupo_id: string; categoria: string; cantidad: number }>("SELECT n.grupo_id,c.categoria,count(*)::int AS cantidad FROM v_nomina_ciclo n JOIN condicion_catequizando c ON c.catequizando_id=n.catequizando_id WHERE n.grupo_id=ANY($1::uuid[]) GROUP BY n.grupo_id,c.categoria", [candidatos.map(g => g.id)]);
  return candidatos.map(g => ({ ...g, conteosCondiciones: Object.fromEntries(conteos.rows.filter(c => c.grupo_id === g.id).map(c => [c.categoria, c.cantidad])) }));
}
export async function asignarGrupo(tx: Tx, inscripcionId: string, datos: z.infer<typeof esquemas.asignar>, contexto: ContextoAcceso) {
  const consulta = await tx.query<{ catequizando_id: string }>("SELECT catequizando_id FROM inscripcion WHERE id=$1", [inscripcionId]);
  if (!consulta.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const ninoId = consulta.rows[0].catequizando_id;
  await bloquearNino(tx, ninoId);
  const i = await tx.query<{ ciclo_id: string; fecha_nacimiento: string; sexo: "femenino" | "masculino" }>("SELECT i.ciclo_id,n.fecha_nacimiento::text,n.sexo FROM inscripcion i JOIN catequizando n ON n.id=i.catequizando_id WHERE i.id=$1 AND i.estado='vigente' FOR UPDATE OF i", [inscripcionId]);
  if (!i.rows[0]) throw new ErrorAplicacion(409, "inscripcion_no_vigente");
  const ciclo = await cicloAbierto(tx, i.rows[0].ciclo_id);
  const g = await tx.query<{ edad_minima: number; edad_maxima: number; modalidad: string }>("SELECT edad_minima,edad_maxima,modalidad FROM grupo WHERE id=$1 AND ciclo_id=$2 AND estado='abierto' FOR UPDATE", [datos.grupoId, i.rows[0].ciclo_id]);
  if (!g.rows[0]) throw new ErrorAplicacion(422, "grupo_no_disponible");
  const repetido = await tx.query("SELECT id FROM asignacion_grupo WHERE id=$1 AND inscripcion_id=$2 AND grupo_id=$3 AND motivo IS NOT DISTINCT FROM $4", [datos.id, inscripcionId, datos.grupoId, datos.motivo ?? null]);
  if (repetido.rowCount) return { asignacionId: datos.id };
  if ((await tx.query("SELECT id FROM asignacion_grupo WHERE id=$1", [datos.id])).rowCount) throw new ErrorAplicacion(409, "uuid_en_conflicto");
  const anterior = await tx.query<{ grupo_id: string }>("UPDATE asignacion_grupo SET hasta=clock_timestamp() WHERE inscripcion_id=$1 AND hasta IS NULL RETURNING grupo_id", [inscripcionId]);
  const edad = edadEnFecha(i.rows[0].fecha_nacimiento, ciclo.inicio);
  const fuera = !(g.rows[0].edad_minima <= edad && edad <= g.rows[0].edad_maxima && g.rows[0].modalidad === modalidadHabitual(edad, i.rows[0].sexo));
  await tx.query("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia,motivo) VALUES($1,$2,$3,$4,$5,$6)", [datos.id, inscripcionId, datos.grupoId, contexto.cuentaId, fuera, datos.motivo ?? null]);
  await cambio(tx, { id: datos.cambioId, catequizandoId: ninoId, entidad: "asignacion_grupo", entidadId: datos.id, campo: "grupoId", anterior: anterior.rows[0]?.grupo_id ?? null, nuevo: datos.grupoId, cuentaId: contexto.cuentaId, motivo: datos.motivo });
  return { asignacionId: datos.id, fueraDeSugerencia: fuera };
}
