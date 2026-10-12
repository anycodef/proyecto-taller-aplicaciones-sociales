import type { Tx } from "../../../compartido/bd/transaccion";
import { interpretarCodigoQr } from "@/lib/asistencia/carne";
import { PARAMETROS_PREDETERMINADOS, type Correccion, type MarcaAsistencia, type ParametrosAsistencia, type Sesion } from "@/lib/asistencia/tipos";
import { idAviso } from "@/lib/asistencia/sesiones";
export async function resolverCarneServidor(codigo: string, tx: Tx): Promise<{ estado: "valido" | "invalido" | "inactivo"; catequizandoId?: string }> {
  const qr = interpretarCodigoQr(codigo);
  if (!qr) return { estado: "invalido" };
  const filas = await tx.query<{ activo: boolean }>(`SELECT EXISTS(SELECT 1 FROM inscripcion i JOIN ciclo c ON c.id=i.ciclo_id
    WHERE i.catequizando_id=n.id AND i.estado='vigente' AND c.estado='abierto') AND n.estado='vigente' AS activo
    FROM catequizando n JOIN carne_emision e ON e.catequizando_id=n.id
    WHERE n.id=$1 AND e.emision=$2 AND e.invalidada_en IS NULL`, [qr.catequizandoId, qr.emision]);
  return filas.rows.length ? { estado: filas.rows[0].activo ? "valido" : "inactivo", catequizandoId: qr.catequizandoId } : { estado: "invalido" };
}
export async function leerSesion(id: string, tx: Tx): Promise<Sesion | undefined> {
  const resultado = await tx.query<{ id: string; ciclo_id: string; fecha: string; tipo: Sesion["tipo"]; actividad_id: string | null; cancelada: boolean; ventana_inicio: string | null; ventana_fin: string | null }>(
    "SELECT id,ciclo_id,fecha::text,tipo,actividad_id,cancelada,ventana_inicio::text,ventana_fin::text FROM sesion WHERE id=$1 AND eliminado_en IS NULL", [id]);
  const fila = resultado.rows[0];
  return fila && { id: fila.id, cicloId: fila.ciclo_id, fecha: fila.fecha, tipo: fila.tipo, actividadId: fila.actividad_id, cancelada: fila.cancelada, ventanaInicio: fila.ventana_inicio, ventanaFin: fila.ventana_fin };
}
export async function leerParametros(cicloId: string, tx: Tx): Promise<ParametrosAsistencia> {
  const resultado = await tx.query<{ ventana_misa_inicio: string; ventana_misa_fin: string; hora_fin_domingo: string; tolerancia_reloj_min: number }>("SELECT ventana_misa_inicio::text,ventana_misa_fin::text,hora_fin_domingo::text,tolerancia_reloj_min FROM parametros_asistencia_ciclo WHERE ciclo_id=$1", [cicloId]);
  const fila = resultado.rows[0];
  return fila ? { zonaHoraria: "America/Lima", ventanaMisaInicio: fila.ventana_misa_inicio, ventanaMisaFin: fila.ventana_misa_fin, horaFinDomingo: fila.hora_fin_domingo, toleranciaRelojMin: fila.tolerancia_reloj_min } : PARAMETROS_PREDETERMINADOS;
}
export async function crearAviso(tx: Tx, entrada: { tipo: string; cicloId: string; sesionId: string; referencia: string; catequizandoId?: string | null; marcaId?: string; motivo?: string }): Promise<void> {
  await tx.query(`INSERT INTO aviso_asistencia(id,ciclo_id,tipo,sesion_id,catequizando_id,marca_id,detalle)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`, [idAviso(entrada.tipo, entrada.sesionId, entrada.referencia), entrada.cicloId, entrada.tipo, entrada.sesionId, entrada.catequizandoId ?? null, entrada.marcaId ?? null, JSON.stringify({ motivo: entrada.motivo ?? entrada.tipo })]);
}
export async function leerMarcas(sesionId: string, ninoId: string, tx: Tx): Promise<MarcaAsistencia[]> {
  const resultado = await tx.query<{ id: string; ciclo_id: string; sesion_id: string; catequizando_id: string; valor: MarcaAsistencia["valor"]; tipo_registro: MarcaAsistencia["tipoRegistro"]; registrado_por: string; credencial_id: string; dispositivo_id: string; hora_dispositivo: Date; desfase_reloj_ms: string; recibido_en: string }>(
    `SELECT id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,registrado_por,credencial_id,dispositivo_id,hora_dispositivo,desfase_reloj_ms,
      to_char(recibido_en AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recibido_en
      FROM marca_asistencia WHERE sesion_id=$1 AND catequizando_id=$2 AND estado='aceptada' AND eliminado_en IS NULL`, [sesionId, ninoId]);
  return resultado.rows.map(fila => ({ id: fila.id, cicloId: fila.ciclo_id, sesionId: fila.sesion_id, catequizandoId: fila.catequizando_id, valor: fila.valor, tipoRegistro: fila.tipo_registro, registradoPor: fila.registrado_por, credencialId: fila.credencial_id, dispositivoId: fila.dispositivo_id, horaDispositivo: fila.hora_dispositivo.toISOString(), desfaseRelojMs: Number(fila.desfase_reloj_ms), recibidoEn: fila.recibido_en, estado: "aceptada" }));
}
export async function leerCorrecciones(sesionId: string, ninoId: string, tx: Tx): Promise<Correccion[]> {
  const resultado = await tx.query<{ id: string; ciclo_id: string; sesion_id: string; catequizando_id: string; valor_anterior: Correccion["valorAnterior"]; valor_nuevo: Correccion["valorNuevo"]; motivo: string; corregido_por: string; credencial_id: string; hora_dispositivo: Date; desfase_reloj_ms: string; recibido_en: string }>(
    `SELECT id,ciclo_id,sesion_id,catequizando_id,valor_anterior,valor_nuevo,motivo,corregido_por,credencial_id,hora_dispositivo,desfase_reloj_ms,
      to_char(recibido_en AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recibido_en
      FROM correccion_asistencia WHERE sesion_id=$1 AND catequizando_id=$2 AND estado='aceptada' AND eliminado_en IS NULL`, [sesionId, ninoId]);
  return resultado.rows.map(fila => ({ id: fila.id, cicloId: fila.ciclo_id, sesionId: fila.sesion_id, catequizandoId: fila.catequizando_id, valorAnterior: fila.valor_anterior, valorNuevo: fila.valor_nuevo, motivo: fila.motivo, corregidoPor: fila.corregido_por, credencialId: fila.credencial_id, horaDispositivo: fila.hora_dispositivo.toISOString(), desfaseRelojMs: Number(fila.desfase_reloj_ms), recibidoEn: fila.recibido_en, estado: "aceptada" }));
}
