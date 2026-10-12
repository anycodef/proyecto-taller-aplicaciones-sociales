import { randomUUID } from "node:crypto";
import type { PeticionInscripcion, RespuestaInscripcion } from "@/lib/catequizandos/contratos";
import { claveDuplicado } from "@/lib/catequizandos/duplicados";
import { edadAlInicioDelCiclo, estaEnRangoCatequesis } from "@/lib/catequizandos/edad";
import { estadosIniciales } from "@/lib/catequizandos/documentos";
import { modalidadHabitual } from "@/lib/catequizandos/grupos";
import { codificarCarne } from "@/lib/catequizandos/carne";
import { puedeGestionarInscripciones } from "@/lib/catequizandos/autorizacion";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { cicloAbierto, huella } from "../../catequizandos/infraestructura/comun";
import { crearVinculo } from "../../catequizandos/aplicacion/apoderados";
import { auditarAcceso } from "../../catequizandos/infraestructura/auditoria";
import { registrarConsentimiento } from "../../seguridad/aplicacion/consentimientos";
type Resultado = { estado: 200 | 201; datos: RespuestaInscripcion } | { estado: 409; datos: { codigo: "posible_duplicado"; referencia: string } };
export async function crearInscripcion(tx: Tx, datos: PeticionInscripcion, contexto: ContextoAcceso): Promise<Resultado> {
  if (!puedeGestionarInscripciones(contexto)) throw new ErrorAplicacion(403, "fuera_de_alcance");
  if (!datos.consentimiento) throw new ErrorAplicacion(422, "sin_consentimiento");
  const n = datos.nino, firma = huella(datos);
  // Serializa reintentos y altas de la misma clave aun si todavía no hay perfil.
  const clave = claveDuplicado(n.nombres, n.apellidos, n.fechaNacimiento);
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`inscripcion:${datos.id}`]);
  const existente = await tx.query<{ huella_peticion: string; catequizando_id: string }>("SELECT huella_peticion,catequizando_id FROM inscripcion WHERE id=$1", [datos.id]);
  if (existente.rows[0]) {
    if (existente.rows[0].huella_peticion !== firma) throw new ErrorAplicacion(409, "uuid_en_conflicto");
    const e = await tx.query<{ emision: number }>("SELECT emision FROM carne_emision WHERE catequizando_id=$1 ORDER BY emision DESC LIMIT 1", [n.id]);
    return { estado: 200, datos: { inscripcionId: datos.id, catequizandoId: n.id, codigoCarne: codificarCarne(n.id, e.rows[0].emision), enlaces: [] } };
  }
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [clave]);
  const ciclo = await cicloAbierto(tx);
  let edad: number;
  try { edad = edadAlInicioDelCiclo(n.fechaNacimiento, ciclo.inicio); } catch { throw new ErrorAplicacion(422, "fecha_invalida"); }
  if (!estaEnRangoCatequesis(edad) && !datos.edadFueraRangoConfirmada) throw new ErrorAplicacion(422, "edad_fuera_de_rango_sin_confirmar");
  const grupos = await tx.query<{ id: string; edad_minima: number; edad_maxima: number; modalidad: string }>("SELECT id,edad_minima,edad_maxima,modalidad FROM grupo WHERE id=$1 AND ciclo_id=$2 AND estado='abierto' FOR UPDATE", [datos.grupoId, ciclo.id]);
  const g = grupos.rows[0];
  if (!g) throw new ErrorAplicacion(422, "grupo_no_disponible");
  let referencia: { catequizando_id: string; es_el_mismo: boolean } | undefined;
  if (datos.referenciaDuplicado) {
    const r = await tx.query<{ catequizando_id: string; es_el_mismo: boolean }>("SELECT catequizando_id,es_el_mismo FROM referencia_duplicado WHERE id=$1 AND cuenta_id=$2 AND vence_en>clock_timestamp() AND clave_duplicado=$3 AND confirmado_en IS NOT NULL FOR UPDATE", [datos.referenciaDuplicado, contexto.cuentaId, clave]);
    referencia = r.rows[0];
    if (!referencia || (referencia.es_el_mismo && referencia.catequizando_id !== n.id)) throw new ErrorAplicacion(403, "fuera_de_alcance");
  }
  const perfil = await tx.query<{ id: string; clave_duplicado: string; estado: string; nombres: string; apellidos: string; fecha_nacimiento: string; sexo: string; bautizado: boolean }>("SELECT id,clave_duplicado,estado,nombres,apellidos,fecha_nacimiento::text,sexo,bautizado FROM catequizando WHERE id=$1 FOR UPDATE", [n.id]);
  const previo = perfil.rows[0];
  if (previo && (previo.estado === "anonimizado" || previo.nombres !== n.nombres || previo.apellidos !== n.apellidos || previo.fecha_nacimiento !== n.fechaNacimiento || previo.sexo !== n.sexo || previo.bautizado !== n.bautizado)) throw new ErrorAplicacion(409, "uuid_en_conflicto");
  const duplicado = await tx.query<{ id: string }>("SELECT id FROM catequizando WHERE clave_duplicado=$1 AND id<>$2 AND estado<>'anonimizado' ORDER BY creado_en,id LIMIT 1", [clave, n.id]);
  if (duplicado.rows[0] && !referencia) {
    const opaca = randomUUID();
    await tx.query("INSERT INTO referencia_duplicado(id,cuenta_id,catequizando_id,clave_duplicado,vence_en) VALUES($1,$2,$3,$4,clock_timestamp()+interval '15 minutes')", [opaca, contexto.cuentaId, duplicado.rows[0].id, clave]);
    return { estado: 409, datos: { codigo: "posible_duplicado", referencia: opaca } };
  }
  if (!perfil.rowCount) await tx.query("INSERT INTO catequizando(id,nombres,apellidos,fecha_nacimiento,sexo,bautizado,clave_duplicado,creado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [n.id, n.nombres, n.apellidos, n.fechaNacimiento, n.sexo, n.bautizado, clave, contexto.cuentaId]);
  else await tx.query("UPDATE catequizando SET estado='vigente',actualizado_en=clock_timestamp() WHERE id=$1", [n.id]);
  const enlaces: RespuestaInscripcion["enlaces"] = [];
  for (const v of datos.apoderados) { const r = await crearVinculo(tx, n.id, v, contexto); if (r.url) enlaces.push({ apoderadoId: r.apoderadoId, url: r.url }); }
  const consentimiento = datos.consentimiento;
  const vinculado = await tx.query("SELECT id FROM vinculo_apoderado WHERE catequizando_id=$1 AND apoderado_id=$2 AND vigente_hasta IS NULL", [n.id, consentimiento.apoderadoId]);
  const texto = await tx.query("SELECT id FROM texto_consentimiento WHERE id=$1 AND id=(SELECT id FROM texto_consentimiento WHERE vigente_desde<=clock_timestamp() ORDER BY vigente_desde DESC LIMIT 1) AND incluye_clausula_constancia", [consentimiento.textoId]);
  if (!vinculado.rowCount || !texto.rowCount) throw new ErrorAplicacion(422, "consentimiento_invalido");
  await registrarConsentimiento(tx, { ...consentimiento, catequizandoId: n.id }, contexto);
  await tx.query("INSERT INTO inscripcion(id,catequizando_id,ciclo_id,consentimiento_id,edad_al_inicio,edad_fuera_rango_confirmada,duplicado_descartado,huella_peticion) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [datos.id, n.id, ciclo.id, consentimiento.id, edad, datos.edadFueraRangoConfirmada, referencia?.es_el_mismo === false, firma]);
  await tx.query("INSERT INTO asignacion_grupo(id,inscripcion_id,grupo_id,asignado_por,fuera_de_sugerencia) VALUES($1,$2,$3,$4,$5)", [datos.asignacionId, datos.id, g.id, contexto.cuentaId, !(g.edad_minima <= edad && edad <= g.edad_maxima && g.modalidad === modalidadHabitual(edad, n.sexo))]);
  await tx.query("UPDATE carne_emision SET invalidada_en=clock_timestamp() WHERE catequizando_id=$1 AND invalidada_en IS NULL", [n.id]);
  const emision = await tx.query<{ emision: number }>("INSERT INTO carne_emision(catequizando_id,emision,emitida_por) SELECT $1,COALESCE(max(emision),0)+1,$2 FROM carne_emision WHERE catequizando_id=$1 RETURNING emision", [n.id, contexto.cuentaId]);
  for (const doc of estadosIniciales(n.bautizado)) {
    const id = datos.documentos.find(d => d.tipo === doc.tipo)?.id;
    if (!id) throw new ErrorAplicacion(422, "documentos_incompletos");
    await tx.query("INSERT INTO documento_inscripcion(id,inscripcion_id,tipo,estado,fecha_estado) VALUES($1,$2,$3,$4,(clock_timestamp() AT TIME ZONE 'America/Lima')::date)", [id, datos.id, doc.tipo, doc.estado]);
  }
  await auditarAcceso(tx, contexto, "inscripcion:gestionar", n.id);
  return { estado: 201, datos: { inscripcionId: datos.id, catequizandoId: n.id, codigoCarne: codificarCarne(n.id, emision.rows[0].emision), enlaces } };
}
export const inscribir = (datos: PeticionInscripcion, contexto: ContextoAcceso) => enTransaccion(tx => crearInscripcion(tx, datos, contexto));
export async function confirmarDuplicado(tx: Tx, referencia: string, esElMismo: boolean, contexto: ContextoAcceso) {
  const r = await tx.query<{ catequizando_id: string; es_el_mismo: boolean | null }>("SELECT catequizando_id,es_el_mismo FROM referencia_duplicado WHERE id=$1 AND cuenta_id=$2 AND vence_en>clock_timestamp() FOR UPDATE", [referencia, contexto.cuentaId]);
  if (!r.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  if (r.rows[0].es_el_mismo !== null && r.rows[0].es_el_mismo !== esElMismo) throw new ErrorAplicacion(409, "confirmacion_en_conflicto");
  await tx.query("UPDATE referencia_duplicado SET es_el_mismo=$2,confirmado_en=clock_timestamp() WHERE id=$1", [referencia, esElMismo]);
  if (!esElMismo) return { referencia, duplicadoDescartado: true };
  const n = await tx.query("SELECT id AS \"catequizandoId\",nombres,apellidos,fecha_nacimiento::text AS \"fechaNacimiento\",sexo,bautizado FROM catequizando WHERE id=$1 AND estado<>'anonimizado'", [r.rows[0].catequizando_id]);
  if (!n.rows[0]) throw new ErrorAplicacion(403, "fuera_de_alcance");
  return { referencia, catequizandoId: r.rows[0].catequizando_id, perfil: n.rows[0] };
}
