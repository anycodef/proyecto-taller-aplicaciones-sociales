import { createHash } from "node:crypto";
import { v5 } from "uuid";
import { validarActividad } from "@/lib/actividades/catalogo-actividades";
import { idSesion, NAMESPACE_ASISTENCIA } from "@/lib/asistencia/sesiones";
import { rolesEfectivos, type ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import type { Tx } from "../../../compartido/bd/transaccion";
import type { EntradaActividad } from "../dominio/validacion";
import { crearSesionActividad } from "../../asistencia/aplicacion/generar-sesiones";
import { crearAviso } from "../../asistencia/infraestructura/repositorio-pg";
const huella = (fila: EntradaActividad): string => createHash("sha256").update(JSON.stringify(Object.entries(fila).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
export async function actividadYaAplicada(fila: EntradaActividad, operacion: "crear" | "actualizar", cuenta: ContextoAcceso, tx: Tx): Promise<boolean> {
  if (!rolesEfectivos(cuenta).includes("coordinacion") || fila.cuenta_id !== cuenta.cuentaId || fila.credencial_id !== cuenta.credencialId || fila.dispositivo_id !== cuenta.dispositivoId) return false;
  const anterior = (await tx.query<EntradaActividad & { huella_creacion: string | null }>("SELECT *,fecha::text FROM actividad_obligatoria WHERE id=$1", [fila.id])).rows[0];
  if (!anterior || anterior.ciclo_id !== fila.ciclo_id) return false;
  return operacion === "crear" ? anterior.huella_creacion === huella(fila) : Object.entries(fila).every(([campo, valor]) => anterior[campo as keyof EntradaActividad] === valor);
}
export async function procesarActividad(fila: EntradaActividad, operacion: "crear" | "actualizar", cuenta: ContextoAcceso, tx: Tx): Promise<boolean> {
  const sesionId = idSesion(fila.ciclo_id, fila.fecha, "actividad", fila.id);
  async function rechazar(motivo: string): Promise<false> {
    await crearAviso(tx, { tipo: "rechazo_actividad", cicloId: fila.ciclo_id, sesionId, referencia: `${fila.id}:${huella(fila)}`, motivo });
    return false;
  }
  if (!rolesEfectivos(cuenta).includes("coordinacion")) return rechazar("rol_no_autorizado");
  if (fila.cuenta_id !== cuenta.cuentaId || fila.credencial_id !== cuenta.credencialId || fila.dispositivo_id !== cuenta.dispositivoId) return rechazar("autoria_invalida");
  if (!validarActividad({ id: fila.id, cicloId: fila.ciclo_id, nombre: fila.nombre, tipo: fila.tipo, fecha: fila.fecha, estado: fila.estado })) return rechazar("actividad_invalida");
  const ciclo = await tx.query("SELECT id FROM ciclo WHERE id=$1 AND $2::date BETWEEN inicio AND fin", [fila.ciclo_id, fila.fecha]);
  if (!ciclo.rowCount) return rechazar("fecha_fuera_ciclo");
  const anterior = (await tx.query<EntradaActividad & { huella_creacion: string | null }>("SELECT *,fecha::text FROM actividad_obligatoria WHERE id=$1 FOR UPDATE", [fila.id])).rows[0];
  if (operacion === "crear" && anterior) return anterior.huella_creacion === huella(fila) ? true : rechazar("uuid_reutilizado");
  if (operacion === "actualizar" && !anterior) return rechazar("actividad_inexistente");
  if (anterior && (anterior.ciclo_id !== fila.ciclo_id || anterior.creado_por !== fila.creado_por)) return rechazar("actividad_inmutable");
  if (!anterior && fila.creado_por !== cuenta.cuentaId) return rechazar("autoria_invalida");
  const campos = ["nombre", "tipo", "fecha", "estado"] as const;
  if (anterior && campos.every(campo => anterior[campo] === fila[campo])) return true;
  if (anterior && (anterior.fecha !== fila.fecha || anterior.tipo !== fila.tipo)) {
    const registros = await tx.query("SELECT 1 FROM marca_asistencia m JOIN sesion s ON s.id=m.sesion_id WHERE s.actividad_id=$1 AND m.estado='aceptada' LIMIT 1", [fila.id]);
    if (registros.rowCount) return rechazar("actividad_con_asistencias");
  }
  if (anterior) {
    for (const campo of campos.filter(campo => anterior[campo] !== fila[campo])) {
      const cambioId = v5(JSON.stringify(["cambio_actividad", fila.id, campo, anterior[campo], fila[campo], huella(fila)]), NAMESPACE_ASISTENCIA);
      await tx.query("INSERT INTO cambio_actividad(id,ciclo_id,actividad_id,campo,valor_anterior,valor_nuevo,cambiado_por) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING", [cambioId, fila.ciclo_id, fila.id, campo, anterior[campo], fila[campo], cuenta.cuentaId]);
    }
    await tx.query("UPDATE actividad_obligatoria SET nombre=$2,tipo=$3,fecha=$4,estado=$5,cuenta_id=$6,credencial_id=$7,dispositivo_id=$8 WHERE id=$1", [fila.id, fila.nombre, fila.tipo, fila.fecha, fila.estado, cuenta.cuentaId, cuenta.credencialId, cuenta.dispositivoId]);
  } else {
    await tx.query("INSERT INTO actividad_obligatoria(id,ciclo_id,nombre,tipo,fecha,estado,creado_por,cuenta_id,credencial_id,dispositivo_id,huella_creacion) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10)", [fila.id, fila.ciclo_id, fila.nombre, fila.tipo, fila.fecha, fila.estado, cuenta.cuentaId, cuenta.credencialId, cuenta.dispositivoId, huella(fila)]);
  }
  // Al reprogramar cambia el UUID determinista; la sesión anterior queda cancelada.
  await tx.query("UPDATE sesion SET cancelada=true,motivo_cancelacion='actividad_cancelada_o_reprogramada' WHERE actividad_id=$1 AND (id<>$2 OR $3)", [fila.id, sesionId, fila.estado === "cancelada"]);
  if (fila.estado !== "cancelada") {
    await crearSesionActividad(fila.id, tx);
    await tx.query("UPDATE sesion SET cancelada=false,motivo_cancelacion=NULL WHERE id=$1 AND cancelada", [sesionId]);
  }
  return true;
}
