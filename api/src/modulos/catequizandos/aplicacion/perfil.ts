import type { z } from "zod";
import type { DatosNino } from "@/lib/catequizandos/contratos";
import type { Grupo } from "@/lib/catequizandos/modelo";
import { camposDePerfilVisibles } from "@/lib/catequizandos/autorizacion";
import { edadEnFecha } from "@/lib/catequizandos/edad";
import { claveDuplicado } from "@/lib/catequizandos/duplicados";
import { cambiaGrupoSugerido, diferenciasCorregibles } from "@/lib/catequizandos/correcciones";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearNino, cambio, cicloAbierto } from "../infraestructura/comun";
import { resumenesPerfil } from "../dominio/puertos";
import { documentosInscripcion } from "../../inscripciones/aplicacion/documentos";
import type * as esquemas from "../http/esquemas";
const seleccionNino = 'SELECT id,nombres,apellidos,fecha_nacimiento::text AS "fechaNacimiento",sexo,bautizado FROM catequizando WHERE id=$1 AND estado<>\'anonimizado\'';
export async function consultarPerfil(tx: Tx, id: string, contexto: ContextoAcceso) {
  const n = await tx.query<DatosNino>(seleccionNino, [id]);
  const i = await tx.query<{ id: string; cicloId: string; grupoId: string; grupo: string }>('SELECT i.id,i.ciclo_id AS "cicloId",a.grupo_id AS "grupoId",g.nombre AS grupo FROM inscripcion i JOIN ciclo c ON c.id=i.ciclo_id AND c.estado=\'abierto\' JOIN asignacion_grupo a ON a.inscripcion_id=i.id AND a.hasta IS NULL JOIN grupo g ON g.id=a.grupo_id WHERE i.catequizando_id=$1 AND i.estado=\'vigente\'', [id]);
  const campos = camposDePerfilVisibles(contexto, { id, grupoId: i.rows[0]?.grupoId });
  if (!n.rows[0] || !campos.length) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const hoy = (await tx.query<{ fecha: string }>("SELECT (clock_timestamp() AT TIME ZONE 'America/Lima')::date::text AS fecha")).rows[0].fecha;
  const basico = { catequizandoId: id, nombres: n.rows[0].nombres, apellidos: n.rows[0].apellidos, edad: edadEnFecha(n.rows[0].fechaNacimiento, hoy), grupo: i.rows[0] ? { id: i.rows[0].grupoId, nombre: i.rows[0].grupo } : null, documentos: i.rows[0] ? await documentosInscripcion(tx, i.rows[0].id) : [], resumenes: i.rows[0] ? await resumenesPerfil(id, i.rows[0].cicloId, contexto, tx) : {} };
  if (!campos.includes("apoderados")) return basico;
  const apoderados = (await tx.query('SELECT a.id,a.nombres,a.apellidos,a.tipo_contacto AS "tipoContacto",a.valor_contacto AS "valorContacto",v.relacion,v.detalle_relacion AS "detalleRelacion" FROM apoderado a JOIN vinculo_apoderado v ON v.apoderado_id=a.id WHERE v.catequizando_id=$1 AND v.vigente_hasta IS NULL ORDER BY a.apellidos,a.id', [id])).rows;
  const historialGrupos = (await tx.query('SELECT a.id,a.grupo_id AS "grupoId",g.nombre,i.ciclo_id AS "cicloId",a.desde,a.hasta FROM asignacion_grupo a JOIN inscripcion i ON i.id=a.inscripcion_id JOIN grupo g ON g.id=a.grupo_id WHERE i.catequizando_id=$1 ORDER BY a.desde,a.id', [id])).rows;
  return { ...basico, fechaNacimiento: n.rows[0].fechaNacimiento, sexo: n.rows[0].sexo, bautizado: n.rows[0].bautizado, apoderados, historialGrupos };
}
export async function corregirCatequizando(tx: Tx, id: string, datos: z.infer<typeof esquemas.corregir>, contexto: ContextoAcceso) {
  await bloquearNino(tx, id);
  const anterior = (await tx.query<DatosNino>(seleccionNino, [id])).rows[0];
  const nuevo = { ...anterior, ...datos.datos };
  const ciclo = await cicloAbierto(tx);
  try { edadEnFecha(nuevo.fechaNacimiento, ciclo.inicio); } catch { throw new ErrorAplicacion(422, "fecha_invalida"); }
  const repetidos = await tx.query<{ id: string; campo: string; valor_nuevo: unknown; motivo: string | null }>("SELECT id,campo,valor_nuevo,motivo FROM cambio_inscripcion WHERE id=ANY($1::uuid[]) AND catequizando_id=$2 AND cambiado_por=$3 AND entidad='catequizando'", [datos.cambios.map(c => c.id), id, contexto.cuentaId]);
  if (repetidos.rowCount) {
    if (repetidos.rowCount !== datos.cambios.length || !datos.cambios.every(c => repetidos.rows.some(r => r.id === c.id && r.campo === c.campo && r.valor_nuevo === datos.datos[c.campo] && r.motivo === (datos.motivo ?? null)))) throw new ErrorAplicacion(409, "uuid_en_conflicto");
    return { catequizandoId: id, avisoGrupoSugerido: false };
  }
  const diferencias = diferenciasCorregibles(anterior, datos.datos);
  if (diferencias.length !== datos.cambios.length || !diferencias.every(c => datos.cambios.some(d => d.campo === c.campo))) throw new ErrorAplicacion(422, "cambios_incompletos");
  for (const d of diferencias) await cambio(tx, { id: datos.cambios.find(c => c.campo === d.campo)!.id, catequizandoId: id, entidad: "catequizando", entidadId: id, campo: d.campo, anterior: d.valorAnterior, nuevo: d.valorNuevo, cuentaId: contexto.cuentaId, motivo: datos.motivo });
  const grupos = await tx.query<Grupo>('SELECT id,ciclo_id AS "cicloId",nombre,edad_minima AS "edadMinima",edad_maxima AS "edadMaxima",modalidad,estado FROM grupo WHERE ciclo_id=$1', [ciclo.id]);
  const actual = await tx.query<{ grupo_id: string }>("SELECT grupo_id FROM v_nomina_ciclo WHERE catequizando_id=$1", [id]);
  const avisoGrupoSugerido = Boolean(actual.rows[0] && cambiaGrupoSugerido(grupos.rows, anterior, nuevo, actual.rows[0].grupo_id, ciclo.inicio));
  await tx.query("UPDATE catequizando SET nombres=$2,apellidos=$3,fecha_nacimiento=$4,sexo=$5,bautizado=$6,clave_duplicado=$7,actualizado_en=clock_timestamp() WHERE id=$1", [id, nuevo.nombres, nuevo.apellidos, nuevo.fechaNacimiento, nuevo.sexo, nuevo.bautizado, claveDuplicado(nuevo.nombres, nuevo.apellidos, nuevo.fechaNacimiento)]);
  return { catequizandoId: id, avisoGrupoSugerido };
}
export async function consultarCambios(tx: Tx, id: string) {
  return (await tx.query('SELECT h.id,h.entidad,h.entidad_id AS "entidadId",h.campo,h.valor_anterior AS "valorAnterior",h.valor_nuevo AS "valorNuevo",h.cambiado_en AS "cambiadoEn",c.identidad_operativa AS "cambiadoPor",h.motivo FROM cambio_inscripcion h JOIN cuenta c ON c.id=h.cambiado_por WHERE h.catequizando_id=$1 ORDER BY h.cambiado_en,h.id', [id])).rows;
}
