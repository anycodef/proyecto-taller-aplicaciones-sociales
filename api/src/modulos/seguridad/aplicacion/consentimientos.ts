import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import type { DatosConsentimiento } from "@/lib/seguridad/contratos";
import type { Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { auditar } from "./auditar";
export async function registrarConsentimiento(tx: Tx, datos: DatosConsentimiento, ctx?: ContextoAcceso): Promise<{ id: string; creado: boolean }> {
  const autor = ctx?.cuentaId ?? datos.registradoPor;
  if (!autor) throw new ErrorAplicacion(422, "sin_consentimiento");
  const vinculado = await tx.query("SELECT 1 FROM vinculo_apoderado WHERE catequizando_id=$1 AND apoderado_id=$2 AND vigente_desde<=clock_timestamp() AND vigente_hasta IS NULL", [datos.catequizandoId, datos.apoderadoId]);
  if (!vinculado.rowCount) throw new ErrorAplicacion(422, "consentimiento_invalido");
  if (ctx && !rolesEfectivos(ctx).includes("coordinacion")) {
    if (datos.canal !== "enlace" || !ctx.rolesPropios.includes("familia") || !ctx.catequizandosApoderados.includes(datos.catequizandoId)) throw new ErrorAplicacion(403, "fuera_de_alcance");
    const vinculo = await tx.query("SELECT 1 FROM apoderado a JOIN vinculo_apoderado v ON v.apoderado_id=a.id WHERE a.id=$1 AND a.cuenta_id=$2 AND v.catequizando_id=$3 AND v.vigente_hasta IS NULL", [datos.apoderadoId, autor, datos.catequizandoId]);
    if (!vinculo.rowCount) throw new ErrorAplicacion(403, "fuera_de_alcance");
  } else if (ctx && datos.canal !== "presencial") throw new ErrorAplicacion(422, "canal_consentimiento_invalido");
  const vigente = await tx.query("SELECT 1 FROM texto_consentimiento WHERE id=$1 AND vigente_desde<=clock_timestamp() AND incluye_clausula_constancia AND id=(SELECT id FROM texto_consentimiento WHERE vigente_desde<=clock_timestamp() ORDER BY vigente_desde DESC,version DESC LIMIT 1)", [datos.textoId]);
  if (!vigente.rowCount) throw new ErrorAplicacion(422, "texto_consentimiento_no_vigente");
  const resultado = await tx.query("INSERT INTO consentimiento(id,catequizando_id,apoderado_id,texto_id,canal,registrado_por) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING id", [datos.id, datos.catequizandoId, datos.apoderadoId, datos.textoId, datos.canal, autor]);
  if (!resultado.rowCount) {
    const igual = await tx.query("SELECT 1 FROM consentimiento WHERE id=$1 AND catequizando_id=$2 AND apoderado_id=$3 AND texto_id=$4 AND canal=$5 AND registrado_por=$6 AND retirado_en IS NULL", [datos.id, datos.catequizandoId, datos.apoderadoId, datos.textoId, datos.canal, autor]);
    if (!igual.rowCount) throw new ErrorAplicacion(409, "uuid_reutilizado");
  }
  if (ctx && resultado.rowCount) await auditar(ctx, { accion: "consentimiento:registrar", recursoTipo: "consentimiento", recursoId: datos.id, catequizandoId: datos.catequizandoId, resultado: "permitido", detalle: { canal: datos.canal } }, tx);
  return { id: datos.id, creado: !!resultado.rowCount };
}
