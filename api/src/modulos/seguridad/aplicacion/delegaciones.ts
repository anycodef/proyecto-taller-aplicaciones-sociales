import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { validarNuevaDelegacion } from "@/lib/seguridad/delegacion";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { auditar } from "./auditar";
export async function crearDelegacion(datos: { id: string; delegadoId: string; desde: string; hasta: string }, ctx: ContextoAcceso): Promise<boolean> {
  if (!validarNuevaDelegacion(datos, ctx)) throw new ErrorAplicacion(422, "delegacion_invalida");
  return enTransaccion(async tx => {
    const delegado = await tx.query("SELECT 1 FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id WHERE c.id=$1 AND c.activa AND r.rol='catequista' FOR SHARE OF c", [datos.delegadoId]);
    if (!delegado.rowCount) throw new ErrorAplicacion(422, "delegado_no_catequista");
    const resultado = await tx.query("INSERT INTO delegacion(id,delegante_id,delegado_id,desde,hasta) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id", [datos.id, ctx.cuentaId, datos.delegadoId, datos.desde, datos.hasta]);
    if (!resultado.rowCount) {
      const igual = await tx.query("SELECT 1 FROM delegacion WHERE id=$1 AND delegante_id=$2 AND delegado_id=$3 AND desde=$4::timestamptz AND hasta=$5::timestamptz", [datos.id, ctx.cuentaId, datos.delegadoId, datos.desde, datos.hasta]);
      if (!igual.rowCount) throw new ErrorAplicacion(409, "uuid_reutilizado");
    }
    if (resultado.rowCount) await auditar(ctx, { accion: "delegacion:crear", recursoTipo: "delegacion", recursoId: datos.id, resultado: "permitido" }, tx);
    return !!resultado.rowCount;
  });
}
export async function revocarDelegacion(id: string, ctx: ContextoAcceso): Promise<void> {
  await enTransaccion(async tx => {
    const fila = (await tx.query<{ delegante_id: string }>("SELECT delegante_id FROM delegacion WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!fila || (!ctx.rolesPropios.includes("administracion") && fila.delegante_id !== ctx.cuentaId)) throw new ErrorAplicacion(403, "fuera_de_alcance");
    await tx.query("UPDATE delegacion SET revocada_en=COALESCE(revocada_en,now()),revocada_por=COALESCE(revocada_por,$2) WHERE id=$1", [id, ctx.cuentaId]);
    await auditar(ctx, { accion: "delegacion:revocar", recursoTipo: "delegacion", recursoId: id, resultado: "permitido" }, tx);
  });
}
