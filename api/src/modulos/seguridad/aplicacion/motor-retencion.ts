import { BlobServiceClient } from "@azure/storage-blob";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
import { consultar } from "../../../compartido/bd/pool";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { auditar } from "./auditar";
export type RefBlob = { contenedor: string; ruta: string };
export interface ParticipanteRetencion {
  nombre: string;
  tablas?: string[];
  alRetirarConsentimiento(catequizandoId: string, tx: Tx): Promise<{ blobs: RefBlob[]; cantidad?: number }>;
  alVencerCiclo(cicloId: string, tx: Tx): Promise<{ blobs: RefBlob[]; cantidad?: number }>;
}
const participantes = new Map<string, ParticipanteRetencion>();
export function registrarParticipanteRetencion(participante: ParticipanteRetencion): void {
  if (participantes.has(participante.nombre)) {
    if (participantes.get(participante.nombre) === participante) return;
    throw new Error(`participante_retencion_duplicado:${participante.nombre}`);
  }
  participantes.set(participante.nombre, participante);
}
export async function verificarCoberturaRetencion(tx: Tx): Promise<void> {
  const tablas = await tx.query<{ table_name: string }>(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema=current_schema() AND c.column_name='catequizando_id' AND t.table_type='BASE TABLE'`);
  const cubiertas = new Set([...participantes.values()].flatMap(p => p.tablas ?? []));
  const faltantes = tablas.rows.map(t => t.table_name).filter(t => !cubiertas.has(t));
  if (faltantes.length) throw new Error(`tablas_sin_participante_retencion:${faltantes.sort().join(",")}`);
}
export interface BorradorBlobs { borrar(ref: RefBlob): Promise<void> }
export class AzureBorradorBlobs implements BorradorBlobs {
  async borrar(ref: RefBlob): Promise<void> {
    const conexion = process.env.BLOBS_CONEXION;
    if (!conexion) throw new Error("Falta BLOBS_CONEXION");
    await BlobServiceClient.fromConnectionString(conexion).getContainerClient(ref.contenedor).getBlobClient(ref.ruta).deleteIfExists({ deleteSnapshots: "include" });
  }
}
let borrador: BorradorBlobs = new AzureBorradorBlobs();
export function configurarBorradorBlobs(puerto: BorradorBlobs): void { borrador = puerto; }
async function ejecutar(tipo: "retiro_consentimiento" | "vencimiento_ciclo", objetivoId: string, tx: Tx): Promise<string> {
  // No afirmar borrado completo si el módulo dueño del perfil no está conectado.
  if (!participantes.has("catequizandos")) throw new Error("Falta participante de retencion catequizandos");
  await verificarCoberturaRetencion(tx);
  await tx.query("SET LOCAL ROLE sigecat_retencion");
  await tx.query("SELECT set_config('sigecat.contexto',$1,true)", [tipo === "retiro_consentimiento" ? "retiro_consentimiento" : "retencion"]);
  const creada = await tx.query<{ id: string }>("INSERT INTO ejecucion_retencion(tipo,objetivo_id) VALUES($1,$2) ON CONFLICT(tipo,objetivo_id) DO NOTHING RETURNING id", [tipo, objetivoId]);
  if (!creada.rowCount) {
    const anterior = await tx.query<{ id: string; completada_en: Date | null }>("SELECT id,completada_en FROM ejecucion_retencion WHERE tipo=$1 AND objetivo_id=$2 FOR UPDATE", [tipo, objetivoId]);
    if (!anterior.rows[0]?.completada_en) throw new Error("retencion_incompleta");
    return anterior.rows[0].id;
  }
  const id = creada.rows[0]!.id;
  const resumen: Record<string, { blobs: number; cantidad: number }> = {};
  for (const participante of participantes.values()) {
    const resultado = tipo === "retiro_consentimiento" ? await participante.alRetirarConsentimiento(objetivoId, tx) : await participante.alVencerCiclo(objetivoId, tx);
    resumen[participante.nombre] = { blobs: resultado.blobs.length, cantidad: resultado.cantidad ?? 0 };
    for (const blob of resultado.blobs) await tx.query("INSERT INTO borrado_blob_pendiente(ejecucion_id,contenedor,ruta) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [id, blob.contenedor, blob.ruta]);
  }
  await tx.query("UPDATE ejecucion_retencion SET completada_en=now(),resumen=$2 WHERE id=$1", [id, JSON.stringify(resumen)]);
  return id;
}
export async function borrarBlobsPendientes(ejecucionId?: string): Promise<{ borrados: number; fallidos: number }> {
  const pendientes = await consultar<{ id: string }>("SELECT id FROM borrado_blob_pendiente WHERE completado_en IS NULL AND ($1::uuid IS NULL OR ejecucion_id=$1) ORDER BY creado_en LIMIT 100", [ejecucionId ?? null]);
  let borrados = 0;
  let fallidos = 0;
  for (const pendiente of pendientes.rows) {
    const resultado = await enTransaccion(async tx => {
      const fila = (await tx.query<RefBlob & { id: string }>("SELECT id,contenedor,ruta FROM borrado_blob_pendiente WHERE id=$1 AND completado_en IS NULL FOR UPDATE SKIP LOCKED", [pendiente.id])).rows[0];
      if (!fila) return "ocupado";
      try {
        await borrador.borrar(fila);
        await tx.query("UPDATE borrado_blob_pendiente SET completado_en=now(),intentos=intentos+1,ultimo_error=NULL WHERE id=$1", [fila.id]);
        return "borrado";
      } catch {
        // No persistir errores del proveedor: pueden incluir rutas o secretos.
        await tx.query("UPDATE borrado_blob_pendiente SET intentos=intentos+1,ultimo_error='borrado_no_disponible' WHERE id=$1", [fila.id]);
        return "fallido";
      }
    });
    if (resultado === "borrado") borrados++;
    if (resultado === "fallido") fallidos++;
  }
  return { borrados, fallidos };
}
export async function retirarConsentimiento(consentimientoId: string, ctx: ContextoAcceso): Promise<{ ejecucionId: string }> {
  const ejecucionId = await enTransaccion(async tx => {
    const fila = (await tx.query<{ catequizando_id: string; apoderado_id: string }>("SELECT catequizando_id,apoderado_id FROM consentimiento WHERE id=$1", [consentimientoId])).rows[0];
    if (!fila) throw new ErrorAplicacion(403, "fuera_de_alcance");
    // Orden por niño antes de bloquear consentimientos: dos apoderados pueden retirar a la vez.
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`consentimiento:${fila.catequizando_id}`]);
    await tx.query("SELECT id FROM consentimiento WHERE catequizando_id=$1 ORDER BY id FOR UPDATE", [fila.catequizando_id]);
    if (!rolesEfectivos(ctx).includes("coordinacion")) {
      const propio = await tx.query("SELECT 1 FROM apoderado a JOIN vinculo_apoderado v ON v.apoderado_id=a.id WHERE a.id=$1 AND a.cuenta_id=$2 AND v.catequizando_id=$3 AND v.vigente_hasta IS NULL", [fila.apoderado_id, ctx.cuentaId, fila.catequizando_id]);
      // Tras un retiro idempotente el vínculo ya está cerrado; se admite solo al autor del retiro original.
      const anterior = await tx.query("SELECT 1 FROM consentimiento WHERE id=$1 AND retirado_por=$2", [consentimientoId, ctx.cuentaId]);
      if (!ctx.rolesPropios.includes("familia") || (!propio.rowCount && !anterior.rowCount)) throw new ErrorAplicacion(403, "fuera_de_alcance");
    }
    await tx.query("UPDATE consentimiento SET retirado_en=COALESCE(retirado_en,now()),retirado_por=COALESCE(retirado_por,$2),canal_retiro=COALESCE(canal_retiro,$3) WHERE catequizando_id=$1", [fila.catequizando_id, ctx.cuentaId, rolesEfectivos(ctx).includes("coordinacion") ? "presencial" : "enlace"]);
    await auditar(ctx, { accion: "consentimiento:retirar", recursoTipo: "consentimiento", recursoId: consentimientoId, catequizandoId: fila.catequizando_id, resultado: "permitido" }, tx);
    return ejecutar("retiro_consentimiento", fila.catequizando_id, tx);
  });
  await borrarBlobsPendientes(ejecucionId);
  return { ejecucionId };
}
export async function vencerCiclo(cicloId: string): Promise<{ ejecucionId: string }> {
  const ejecucionId = await enTransaccion(async tx => {
    const vencido = await tx.query("SELECT id FROM ciclo WHERE id=$1 AND estado='cerrado' AND cerrado_en+interval '2 years'<=clock_timestamp() FOR UPDATE", [cicloId]);
    if (!vencido.rowCount) throw new ErrorAplicacion(409, "retencion_no_vencida");
    return ejecutar("vencimiento_ciclo", cicloId, tx);
  });
  await borrarBlobsPendientes(ejecucionId);
  return { ejecucionId };
}
export const motorRetencion = { retirarConsentimiento, vencerCiclo };
export const participanteSeguridad: ParticipanteRetencion = {
  nombre: "seguridad",
  tablas: ["cuenta", "identidad_real", "credencial", "sesion_renovacion", "rol_cuenta", "delegacion", "consentimiento", "evento_auditoria", "aviso_coordinacion"],
  async alRetirarConsentimiento(catequizandoId, tx) {
    await tx.query("UPDATE consentimiento SET retirado_en=COALESCE(retirado_en,now()) WHERE catequizando_id=$1", [catequizandoId]);
    await tx.query("UPDATE evento_auditoria SET detalle='{}' WHERE catequizando_id=$1", [catequizandoId]);
    await terminarFamiliasSinVinculos(tx);
    return { blobs: [] };
  },
  async alVencerCiclo(cicloId, tx) {
    // Participación posterior: se conserva identidad si sigue asignado a un ciclo posterior.
    await tx.query(`DELETE FROM identidad_real i USING cuenta c WHERE i.cuenta_id=c.id AND NOT c.activa
      AND EXISTS(SELECT 1 FROM grupo_catequista gc JOIN grupo g ON g.id=gc.grupo_id WHERE gc.cuenta_id=c.id AND g.ciclo_id=$1)
      AND NOT EXISTS(SELECT 1 FROM grupo_catequista gc JOIN grupo g ON g.id=gc.grupo_id JOIN ciclo posterior ON posterior.id=g.ciclo_id JOIN ciclo vencido ON vencido.id=$1 WHERE gc.cuenta_id=c.id AND posterior.inicio>vencido.inicio)`, [cicloId]);
    await tx.query("UPDATE evento_auditoria SET detalle='{}' WHERE catequizando_id IN (SELECT catequizando_id FROM inscripcion WHERE ciclo_id=$1)", [cicloId]);
    await terminarFamiliasSinVinculos(tx);
    return { blobs: [] };
  },
};
async function terminarFamiliasSinVinculos(tx: Tx): Promise<void> {
  await tx.query(`UPDATE credencial cr SET estado='terminada',terminada_en=now(),motivo_fin='sin_vinculos' WHERE cr.tipo='familia' AND cr.estado<>'terminada'
    AND NOT EXISTS(SELECT 1 FROM apoderado a JOIN vinculo_apoderado v ON v.apoderado_id=a.id WHERE a.cuenta_id=cr.cuenta_id AND v.vigente_hasta IS NULL)`);
}
