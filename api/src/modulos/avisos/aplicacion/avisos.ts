import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import { autorizar } from "@/lib/seguridad/autorizacion";
import { validarAviso } from "@/lib/avisos/avisos";
import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { auditar } from "../../seguridad/index";
import type { ParticipanteRetencion } from "../../seguridad/index";
import type { ProveedorSincronizacion } from "../../sincronizacion/aplicacion/registro-proveedores";
export async function publicarAviso(datos: { id: string; grupoId: string; texto: string }, ctx: ContextoAcceso): Promise<boolean> {
  if (!autorizar(ctx, "aviso:publicar", { grupoId: datos.grupoId }).permitido) throw new ErrorAplicacion(403, "fuera_de_alcance");
  if (!validarAviso(datos.texto)) throw new ErrorAplicacion(422, "aviso_invalido");
  return enTransaccion(async tx => {
    const grupo = await tx.query("SELECT 1 FROM grupo g JOIN ciclo c ON c.id=g.ciclo_id WHERE g.id=$1 AND g.estado='abierto' AND c.estado='abierto' FOR SHARE OF g,c", [datos.grupoId]);
    if (!grupo.rowCount) throw new ErrorAplicacion(409, "grupo_no_abierto");
    const resultado = await tx.query("INSERT INTO aviso_grupo(id,grupo_id,autor_id,texto) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id", [datos.id, datos.grupoId, ctx.cuentaId, datos.texto]);
    if (!resultado.rowCount) {
      const igual = await tx.query("SELECT 1 FROM aviso_grupo WHERE id=$1 AND grupo_id=$2 AND autor_id=$3 AND texto=$4", [datos.id, datos.grupoId, ctx.cuentaId, datos.texto]);
      if (!igual.rowCount) throw new ErrorAplicacion(409, "uuid_reutilizado");
    }
    if (resultado.rowCount) await auditar(ctx, { accion: "aviso:publicar", recursoTipo: "aviso_grupo", recursoId: datos.id, resultado: "permitido" }, tx);
    return !!resultado.rowCount;
  });
}
export async function retirarAviso(id: string, ctx: ContextoAcceso): Promise<void> {
  if (!autorizar(ctx, "aviso:publicar").permitido) throw new ErrorAplicacion(403, "fuera_de_alcance");
  await enTransaccion(async tx => {
    const aviso = await tx.query("SELECT 1 FROM aviso_grupo a JOIN grupo g ON g.id=a.grupo_id JOIN ciclo c ON c.id=g.ciclo_id WHERE a.id=$1 AND c.estado='abierto' FOR UPDATE OF a", [id]);
    if (!aviso.rowCount) throw new ErrorAplicacion(409, "aviso_no_disponible");
    await tx.query("UPDATE aviso_grupo SET retirado_en=COALESCE(retirado_en,now()) WHERE id=$1", [id]);
    await auditar(ctx, { accion: "aviso:retirar", recursoTipo: "aviso_grupo", recursoId: id, resultado: "permitido" }, tx);
  });
}
export const proveedorAvisos: ProveedorSincronizacion = {
  tablas: ["avisos_grupo"],
  async pull(peticion, tx) {
    const filas = await tx.query<{ id: string; grupo_id: string; texto: string; autor_visible: string; publicado_en: Date; retirado_en: Date | null }>(`SELECT a.id,a.grupo_id,a.texto,c.identidad_operativa autor_visible,a.publicado_en,a.retirado_en FROM aviso_grupo a JOIN cuenta c ON c.id=a.autor_id JOIN grupo g ON g.id=a.grupo_id
      WHERE g.ciclo_id=$1 AND ($5 OR a.grupo_id=ANY($2::uuid[])) AND ($3::bigint IS NULL OR a.actualizado_en>to_timestamp($3/1000.0)) AND a.actualizado_en<=to_timestamp($4/1000.0)`, [peticion.cicloId, peticion.cuenta.gruposAsignados, peticion.desde, peticion.hasta, rolesEfectivos(peticion.cuenta).includes("coordinacion")]);
    const activos = filas.rows.filter(f => !f.retirado_en).map(({ id, grupo_id, texto, autor_visible, publicado_en }) => ({ id, grupo_id, texto, autor_visible, publicado_en: publicado_en.getTime() }));
    return { avisos_grupo: { created: peticion.desde === null ? activos : [], updated: peticion.desde === null ? [] : activos, deleted: filas.rows.filter(f => f.retirado_en).map(f => f.id) } };
  },
};
export const participanteRetencionAvisos: ParticipanteRetencion = {
  nombre: "avisos",
  tablas: ["aviso_grupo"],
  async alRetirarConsentimiento() { return { blobs: [] }; },
  async alVencerCiclo(cicloId, tx) {
    const resultado = await tx.query("UPDATE aviso_grupo SET texto='Aviso retirado',retirado_en=COALESCE(retirado_en,now()) WHERE grupo_id IN (SELECT id FROM grupo WHERE ciclo_id=$1)", [cicloId]);
    return { blobs: [], cantidad: resultado.rowCount ?? 0 };
  },
};
export async function avisosParaSincronizar(tx: Tx, ctx: ContextoAcceso, desde: number): Promise<{ creados: unknown[]; actualizados: unknown[]; eliminados: string[] }> {
  const filas = await tx.query<{ id: string; retirado_en: Date | null; grupo_id: string; texto: string; autor_visible: string; publicado_en: Date }>(`SELECT a.id,a.grupo_id,a.texto,c.identidad_operativa autor_visible,a.publicado_en,a.retirado_en FROM aviso_grupo a JOIN cuenta c ON c.id=a.autor_id WHERE a.grupo_id=ANY($1::uuid[]) AND a.actualizado_en>to_timestamp($2/1000.0)`, [ctx.gruposAsignados, Math.max(0, desde - 60000)]);
  const activos = filas.rows.filter(f => !f.retirado_en).map(({ id, grupo_id, texto, autor_visible, publicado_en }) => ({ id, grupo_id, texto, autor_visible, publicado_en: publicado_en.getTime() }));
  return { creados: desde === 0 ? activos : [], actualizados: desde === 0 ? [] : activos, eliminados: filas.rows.filter(f => f.retirado_en).map(f => f.id) };
}
