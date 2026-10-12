import { ROLES, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { consultar } from "../../../compartido/bd/pool";
import type { Tx } from "../../../compartido/bd/transaccion";
export type EventoAuditoria = { accion: string; recursoTipo?: string; recursoId?: string; catequizandoId?: string; resultado: "permitido" | "denegado"; detalle?: Record<string, unknown> };
// Lista cerrada: no aceptar valores libres evita filtrar datos a través de claves inocuas.
const clavesPermitidas = new Set(["cantidad", "roles", "motivo", "campos", "tipo", "canal", "version"]);
const valoresPermitidos = /^[a-z0-9_:\-]{1,80}$/;
const enumeraciones: Record<string, ReadonlySet<string>> = {
  roles: new Set(ROLES),
  motivo: new Set(["revocacion", "reemision", "bloqueo_pin", "cuenta_desactivada", "cierre_ciclo", "sin_vinculos", "fuera_de_alcance", "accion_desconocida", "credencial_terminada"]),
  tipo: new Set(["equipo", "familia", "pendientes_rechazados", "retiro_consentimiento", "vencimiento_ciclo"]),
  canal: new Set(["presencial", "enlace"]),
  campos: new Set(["identidad_operativa", "es_menor", "activa", "roles", "nombres", "apellidos", "fecha_nacimiento", "grupo_id", "documentos", "condiciones", "consentimiento"]),
};
export function validarDetalle(detalle: Record<string, unknown>): void {
  for (const [clave, valor] of Object.entries(detalle)) {
    if (!clavesPermitidas.has(clave)) throw new Error("detalle_auditoria_restringido");
    const valores = Array.isArray(valor) ? valor : [valor];
    if (valores.length > 30 || valores.some(v => !(typeof v === "number" && Number.isSafeInteger(v) && v >= 0) && !(typeof v === "string" && !/[^a-z0-9_:\-]/.test(v) && valoresPermitidos.test(v)))) throw new Error("detalle_auditoria_restringido");
    if (clave === "cantidad" && valores.some(v => typeof v !== "number")) throw new Error("detalle_auditoria_restringido");
    if (clave === "version" && valores.some(v => typeof v !== "string" || !/^[0-9]+$/.test(v))) throw new Error("detalle_auditoria_restringido");
    if (enumeraciones[clave] && valores.some(v => typeof v !== "string" || !enumeraciones[clave]!.has(v))) throw new Error("detalle_auditoria_restringido");
  }
}
export async function auditar(ctx: ContextoAcceso, evento: EventoAuditoria, tx?: Tx): Promise<void> {
  validarDetalle(evento.detalle ?? {});
  const sql = "INSERT INTO evento_auditoria(cuenta_id,credencial_id,delegacion_id,accion,recurso_tipo,recurso_id,catequizando_id,resultado,detalle) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)";
  const parametros = [ctx.cuentaId, ctx.credencialId, ctx.delegacionVigente?.id ?? null, evento.accion, evento.recursoTipo ?? null, evento.recursoId ?? null, evento.catequizandoId ?? null, evento.resultado, JSON.stringify(evento.detalle ?? {})];
  if (tx) await tx.query(sql, parametros); else await consultar(sql, parametros);
}
