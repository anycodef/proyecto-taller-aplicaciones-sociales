import { rolesEfectivos, type ContextoAcceso, type Rol } from "@/lib/seguridad/contexto-acceso";
import type { AltaCuenta } from "@/lib/seguridad/contratos";
import { validarAlta, esMenorAlInicioDeCiclo } from "@/lib/seguridad/seudonimo";
import { construirUrlEnlace } from "@/lib/seguridad/enlaces";
import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
import { consultar } from "../../../compartido/bd/pool";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { generarToken, hashToken } from "../dominio/tokens";
import { auditar } from "./auditar";
export type MotivoFin = "revocacion" | "reemision" | "bloqueo_pin" | "cuenta_desactivada" | "cierre_ciclo" | "sin_vinculos";
export function comprobarRolesGestionables(ctx: ContextoAcceso, roles: Rol[]): void {
  if (ctx.rolesPropios.includes("administracion")) return;
  if (!rolesEfectivos(ctx).includes("coordinacion") || !roles.length || roles.some(r => r !== "catequista" && r !== "familia")) throw new ErrorAplicacion(403, "fuera_de_alcance");
}
export async function comprobarCuentaGestionable(tx: Tx, ctx: ContextoAcceso, id: string): Promise<void> {
  await tx.query("SELECT id FROM cuenta WHERE id=$1 FOR UPDATE", [id]);
  const roles = (await tx.query<{ rol: Rol }>("SELECT rol FROM rol_cuenta WHERE cuenta_id=$1", [id])).rows.map(r => r.rol);
  if (!roles.length) throw new ErrorAplicacion(403, "fuera_de_alcance");
  comprobarRolesGestionables(ctx, roles);
}
export async function crearCuenta(datos: AltaCuenta, ctx: ContextoAcceso): Promise<boolean> {
  comprobarRolesGestionables(ctx, datos.roles);
  if (!validarAlta(datos)) throw new ErrorAplicacion(422, "identidad_operativa_invalida");
  return enTransaccion(async tx => {
    if (datos.identidadReal?.fechaNacimiento) {
      const ciclo = (await tx.query<{ inicio: string }>("SELECT inicio::text inicio FROM ciclo WHERE estado='abierto' ORDER BY inicio DESC LIMIT 1")).rows[0];
      if (!ciclo) throw new ErrorAplicacion(409, "ciclo_no_abierto");
      if (esMenorAlInicioDeCiclo(datos.identidadReal.fechaNacimiento, ciclo.inicio) !== datos.esMenor) throw new ErrorAplicacion(422, "minoria_no_coincide_con_ciclo");
    }
    const creada = await tx.query("INSERT INTO cuenta(id,identidad_operativa,es_menor,creada_por) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id", [datos.id, datos.identidadOperativa, datos.esMenor, ctx.cuentaId]);
    if (!creada.rowCount) {
      await comprobarCuentaGestionable(tx, ctx, datos.id);
      const existente = (await tx.query<{ identidad_operativa: string; es_menor: boolean; roles: Rol[] }>("SELECT c.identidad_operativa,c.es_menor,ARRAY(SELECT rol FROM rol_cuenta WHERE cuenta_id=c.id) roles FROM cuenta c WHERE id=$1", [datos.id])).rows[0]!;
      if (existente.identidad_operativa !== datos.identidadOperativa || existente.es_menor !== datos.esMenor || [...existente.roles].sort().join() !== [...new Set(datos.roles)].sort().join()) throw new ErrorAplicacion(409, "uuid_reutilizado");
      return false;
    }
    for (const rol of new Set(datos.roles)) await tx.query("INSERT INTO rol_cuenta(cuenta_id,rol,asignado_por) VALUES($1,$2,$3)", [datos.id, rol, ctx.cuentaId]);
    if (datos.identidadReal) await tx.query("SELECT guardar_identidad_real($1,$2,$3,$4,$5)", [ctx.cuentaId, datos.id, datos.identidadReal.nombres, datos.identidadReal.apellidos, datos.identidadReal.fechaNacimiento ?? null]);
    await auditar(ctx, { accion: "cuentas:crear", recursoTipo: "cuenta", recursoId: datos.id, resultado: "permitido", detalle: { roles: datos.roles } }, tx);
    return true;
  });
}
export async function listarCuentas(ctx: ContextoAcceso, id?: string): Promise<unknown[]> {
  const administrador = ctx.rolesPropios.includes("administracion");
  const filas = await consultar<{ id: string; identidadOperativa: string; esMenor: boolean; activa: boolean; roles: Rol[] }>(`SELECT c.id,c.identidad_operativa "identidadOperativa",c.es_menor "esMenor",c.activa,ARRAY(SELECT rol FROM rol_cuenta WHERE cuenta_id=c.id ORDER BY rol) roles FROM cuenta c
    WHERE ($1::uuid IS NULL OR c.id=$1) AND ($2 OR (EXISTS(SELECT 1 FROM rol_cuenta WHERE cuenta_id=c.id) AND NOT EXISTS(SELECT 1 FROM rol_cuenta WHERE cuenta_id=c.id AND rol NOT IN ('catequista','familia')))) ORDER BY c.identidad_operativa LIMIT 500`, [id ?? null, administrador]);
  if (id && !filas.rows.length) throw new ErrorAplicacion(403, "fuera_de_alcance");
  return filas.rows;
}
export async function reemplazarRoles(id: string, roles: Rol[], ctx: ContextoAcceso): Promise<void> {
  comprobarRolesGestionables(ctx, roles);
  await enTransaccion(async tx => {
    // Orden global antes de las filas de cuenta: evita inversión del bloqueo de último ADM.
    await tx.query("SELECT pg_advisory_xact_lock(1001)");
    await comprobarCuentaGestionable(tx, ctx, id);
    for (const rol of new Set(roles)) await tx.query("INSERT INTO rol_cuenta(cuenta_id,rol,asignado_por) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [id, rol, ctx.cuentaId]);
    await tx.query("DELETE FROM rol_cuenta WHERE cuenta_id=$1 AND NOT(rol=ANY($2::text[]))", [id, roles]);
    await tx.query("UPDATE credencial SET estado='terminada',terminada_en=now(),terminada_por=$4,motivo_fin='revocacion' WHERE cuenta_id=$1 AND estado<>'terminada' AND ((tipo='equipo' AND NOT $2) OR (tipo='familia' AND NOT $3))", [id, roles.some(rol => rol !== "familia"), roles.includes("familia"), ctx.cuentaId]);
    await auditar(ctx, { accion: "roles:reemplazar", recursoTipo: "cuenta", recursoId: id, resultado: "permitido", detalle: { roles } }, tx);
  });
}
export async function revocarEnlace(cuentaId: string, motivo: MotivoFin = "revocacion", tx?: Tx, ctx?: ContextoAcceso): Promise<void> {
  const operacion = async (conexion: Tx) => {
    if (ctx) await comprobarCuentaGestionable(conexion, ctx, cuentaId);
    await conexion.query("UPDATE credencial SET estado='terminada',terminada_en=now(),terminada_por=$3,motivo_fin=$2 WHERE cuenta_id=$1 AND estado<>'terminada'", [cuentaId, motivo, ctx?.cuentaId ?? null]);
    if (ctx) await auditar(ctx, { accion: "enlace:revocar", recursoTipo: "cuenta", recursoId: cuentaId, resultado: "permitido", detalle: { motivo } }, conexion);
  };
  if (tx) await operacion(tx); else await enTransaccion(operacion);
}
export async function desactivarCuenta(id: string, ctx: ContextoAcceso): Promise<void> {
  await enTransaccion(async tx => {
    await tx.query("SELECT pg_advisory_xact_lock(1001)");
    await comprobarCuentaGestionable(tx, ctx, id);
    await tx.query("UPDATE cuenta SET activa=false,desactivada_en=COALESCE(desactivada_en,now()),desactivada_por=$2 WHERE id=$1", [id, ctx.cuentaId]);
    await revocarEnlace(id, "cuenta_desactivada", tx);
    await auditar(ctx, { accion: "cuentas:desactivar", recursoTipo: "cuenta", recursoId: id, resultado: "permitido" }, tx);
  });
}
export async function emitirEnlace(cuentaId: string, tipo: "equipo" | "familia", tx?: Tx, ctx?: ContextoAcceso): Promise<{ url: string; credencialId: string }> {
  const operacion = async (conexion: Tx) => {
    if (ctx) await comprobarCuentaGestionable(conexion, ctx, cuentaId);
    const cuenta = (await conexion.query<{ activa: boolean; roles: Rol[] }>("SELECT c.activa,ARRAY(SELECT rol FROM rol_cuenta WHERE cuenta_id=c.id) roles FROM cuenta c WHERE c.id=$1 FOR UPDATE", [cuentaId])).rows[0];
    if (!cuenta?.activa || !cuenta.roles.some(r => tipo === "familia" ? r === "familia" : r !== "familia")) throw new ErrorAplicacion(409, "tipo_enlace_incompatible");
    const token = generarToken();
    const url = construirUrlEnlace(process.env.URL_WEB ?? process.env.WEB_URL ?? "", tipo, token);
    await conexion.query("UPDATE credencial SET estado='terminada',terminada_en=now(),terminada_por=$3,motivo_fin='reemision' WHERE cuenta_id=$1 AND tipo=$2 AND estado<>'terminada'", [cuentaId, tipo, ctx?.cuentaId ?? null]);
    const resultado = await conexion.query<{ id: string }>("INSERT INTO credencial(cuenta_id,tipo,token_hash,emitida_por) VALUES($1,$2,$3,$4) RETURNING id", [cuentaId, tipo, hashToken(token), ctx?.cuentaId ?? null]);
    if (ctx) await auditar(ctx, { accion: "enlace:emitir", recursoTipo: "cuenta", recursoId: cuentaId, resultado: "permitido", detalle: { tipo } }, conexion);
    return { url, credencialId: resultado.rows[0]!.id };
  };
  return tx ? operacion(tx) : enTransaccion(operacion);
}
// El UUID de la cuenta llega del cliente; apoderadoId no se usa para generar otro UUID servidor.
export async function crearCuentaFamilia(tx: Tx, datos: { cuentaId: string; apoderadoId: string; identidadOperativa: string }, ctx?: ContextoAcceso): Promise<{ cuentaId: string; url?: string }> {
  const creada = await tx.query("INSERT INTO cuenta(id,identidad_operativa,es_menor,creada_por) VALUES($1,$2,false,$3) ON CONFLICT(id) DO NOTHING RETURNING id", [datos.cuentaId, datos.identidadOperativa, ctx?.cuentaId ?? null]);
  if (!creada.rowCount) {
    const igual = await tx.query("SELECT 1 FROM cuenta c JOIN apoderado a ON a.cuenta_id=c.id WHERE c.id=$1 AND a.id=$2 AND c.identidad_operativa=$3", [datos.cuentaId, datos.apoderadoId, datos.identidadOperativa]);
    if (!igual.rowCount) throw new ErrorAplicacion(409, "uuid_reutilizado");
    return { cuentaId: datos.cuentaId };
  }
  await tx.query("INSERT INTO rol_cuenta(cuenta_id,rol,asignado_por) VALUES($1,'familia',$2) ON CONFLICT DO NOTHING", [datos.cuentaId, ctx?.cuentaId ?? null]);
  const vinculado = await tx.query("UPDATE apoderado SET cuenta_id=$2 WHERE id=$1 AND (cuenta_id IS NULL OR cuenta_id=$2)", [datos.apoderadoId, datos.cuentaId]);
  if (!vinculado.rowCount) throw new ErrorAplicacion(409, "apoderado_no_disponible");
  const enlace = await emitirEnlace(datos.cuentaId, "familia", tx, ctx);
  return { cuentaId: datos.cuentaId, url: enlace.url };
}
export async function crearAvisoCoordinacion(tipo: "pendientes_rechazados", datos: { cuentaId: string; cantidad: number; credencialId?: string }, tx?: Tx): Promise<void> {
  const sql = "INSERT INTO aviso_coordinacion(tipo,cuenta_relacionada_id,cantidad,credencial_relacionada_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING";
  const parametros = [tipo, datos.cuentaId, datos.cantidad, datos.credencialId ?? null];
  if (tx) await tx.query(sql, parametros); else await consultar(sql, parametros);
}
