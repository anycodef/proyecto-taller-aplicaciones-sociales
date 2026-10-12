import type { DatosVinculo } from "@/lib/catequizandos/contratos";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { construirUrlEnlace } from "@/lib/seguridad/enlaces";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearNino, cambio } from "../infraestructura/comun";
import { auditar } from "../../seguridad/aplicacion/auditar";
import { generarToken, hashToken } from "../../seguridad/dominio/tokens";
export async function crearVinculo(tx: Tx, catequizandoId: string, datos: DatosVinculo, contexto: ContextoAcceso): Promise<{ apoderadoId: string; url?: string; creado: boolean }> {
  const apoderadoId = "apoderadoId" in datos && datos.apoderadoId ? datos.apoderadoId : datos.apoderado!.id;
  const existente = await tx.query("SELECT id FROM vinculo_apoderado WHERE id=$1 AND catequizando_id=$2 AND apoderado_id=$3 AND relacion=$4 AND detalle_relacion IS NOT DISTINCT FROM $5 AND vigente_hasta IS NULL", [datos.id, catequizandoId, apoderadoId, datos.relacion, datos.detalleRelacion ?? null]);
  if (existente.rowCount) return { apoderadoId, creado: false };
  if ((await tx.query("SELECT id FROM vinculo_apoderado WHERE id=$1 OR (catequizando_id=$2 AND apoderado_id=$3 AND vigente_hasta IS NULL)", [datos.id, catequizandoId, apoderadoId])).rowCount) throw new ErrorAplicacion(409, "vinculo_en_conflicto");
  let url: string | undefined;
  if (datos.apoderado) {
    const a = datos.apoderado;
    // La identidad operativa familiar no contiene nombres del niño ni del apoderado.
    const creado = await tx.query("INSERT INTO cuenta(id,identidad_operativa,es_menor,creada_por) VALUES($1,$2,false,$3) ON CONFLICT(id) DO NOTHING", [a.cuentaId, `Familia ${a.id}`, contexto.cuentaId]);
    if (!creado.rowCount) throw new ErrorAplicacion(409, "uuid_en_conflicto");
    await tx.query("INSERT INTO rol_cuenta(cuenta_id,rol,asignado_por) VALUES($1,'familia',$2)", [a.cuentaId, contexto.cuentaId]);
    await tx.query("INSERT INTO apoderado(id,nombres,apellidos,tipo_contacto,valor_contacto,cuenta_id) VALUES($1,$2,$3,$4,$5,$6)", [a.id, a.nombres, a.apellidos, a.tipoContacto, a.valorContacto, a.cuentaId]);
    const token = generarToken();
    await tx.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,emitida_por) VALUES($1,$2,'familia',$3,$4)", [a.credencialId, a.cuentaId, hashToken(token), contexto.cuentaId]);
    const base = process.env.URL_WEB ?? process.env.WEB_URL;
    if (!base || new URL(base).protocol !== "https:") throw new ErrorAplicacion(503, "web_no_configurada");
    url = construirUrlEnlace(base, "familia", token);
    await auditar(contexto, { accion: "cuentas:crear", recursoTipo: "cuenta", recursoId: a.cuentaId, catequizandoId, resultado: "permitido", detalle: { roles: ["familia"] } }, tx);
    await auditar(contexto, { accion: "enlace:emitir", recursoTipo: "cuenta", recursoId: a.cuentaId, catequizandoId, resultado: "permitido", detalle: { tipo: "familia" } }, tx);
  } else {
    const a = await tx.query("SELECT a.id FROM apoderado a JOIN cuenta c ON c.id=a.cuenta_id WHERE a.id=$1 AND c.activa AND length(trim(a.valor_contacto))>0 FOR UPDATE OF a", [apoderadoId]);
    if (!a.rowCount) throw new ErrorAplicacion(422, "apoderado_no_disponible");
  }
  await tx.query("INSERT INTO vinculo_apoderado(id,catequizando_id,apoderado_id,relacion,detalle_relacion) VALUES($1,$2,$3,$4,$5)", [datos.id, catequizandoId, apoderadoId, datos.relacion, datos.detalleRelacion ?? null]);
  return { apoderadoId, url, creado: true };
}
export async function vincularApoderado(tx: Tx, id: string, datos: DatosVinculo, cambioId: string, contexto: ContextoAcceso) {
  await bloquearNino(tx, id);
  const resultado = await crearVinculo(tx, id, datos, contexto);
  if (resultado.creado) await cambio(tx, { id: cambioId, catequizandoId: id, entidad: "vinculo_apoderado", entidadId: datos.id, campo: "vinculo", anterior: null, nuevo: { apoderadoId: resultado.apoderadoId, relacion: datos.relacion }, cuentaId: contexto.cuentaId });
  return resultado;
}
export async function desvincularApoderado(tx: Tx, id: string, apoderadoId: string, cambioId: string, contexto: ContextoAcceso, motivo?: string) {
  await bloquearNino(tx, id);
  const a = await tx.query<{ cuenta_id: string }>("SELECT cuenta_id FROM apoderado WHERE id=$1 FOR UPDATE", [apoderadoId]);
  if (!a.rowCount) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const v = await tx.query<{ id: string }>("UPDATE vinculo_apoderado SET vigente_hasta=clock_timestamp(),desvinculado_por=$3 WHERE catequizando_id=$1 AND apoderado_id=$2 AND vigente_hasta IS NULL RETURNING id", [id, apoderadoId, contexto.cuentaId]);
  if (v.rows[0]) await cambio(tx, { id: cambioId, catequizandoId: id, entidad: "vinculo_apoderado", entidadId: v.rows[0].id, campo: "vigencia", anterior: "vigente", nuevo: "desvinculado", cuentaId: contexto.cuentaId, motivo });
  const restantes = await tx.query("SELECT id FROM vinculo_apoderado WHERE apoderado_id=$1 AND vigente_hasta IS NULL", [apoderadoId]);
  if (!restantes.rowCount) await tx.query("UPDATE credencial SET estado='terminada',terminada_en=clock_timestamp(),terminada_por=$2,motivo_fin='sin_vinculos' WHERE cuenta_id=$1 AND tipo='familia' AND estado<>'terminada'", [a.rows[0].cuenta_id, contexto.cuentaId]);
  await auditar(contexto, { accion: "apoderado:desvincular", recursoTipo: "apoderado", recursoId: apoderadoId, catequizandoId: id, resultado: "permitido" }, tx);
  return { desvinculado: true, enlaceRevocado: !restantes.rowCount };
}
