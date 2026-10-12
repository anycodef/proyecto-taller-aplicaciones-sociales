import type { SesionAcceso } from "@/lib/seguridad/contratos";
import { enTransaccion } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { hashToken, generarToken, sucesorRenovacion } from "../dominio/tokens";
import { firmarJwt, type IdentidadJwt } from "../infraestructura/firmador-jwt";
import { cargarContexto } from "./contexto";
type FilaCredencial = { id: string; cuenta_id: string; tipo: "equipo" | "familia"; estado: string; dispositivo_id: string | null; activa: boolean };
const denegar = () => new ErrorAplicacion(401, "acceso_denegado");
export async function entrar(token: string, tipo: "equipo" | "familia", dispositivoId?: string): Promise<SesionAcceso> {
  return enTransaccion(async tx => {
    const fila = (await tx.query<FilaCredencial>("SELECT cr.*,c.activa FROM credencial cr JOIN cuenta c ON c.id=cr.cuenta_id WHERE cr.token_hash=$1 FOR UPDATE OF cr,c", [hashToken(token)])).rows[0];
    if (!fila || !fila.activa || fila.tipo !== tipo || fila.estado === "terminada" || (tipo === "equipo" && (!dispositivoId || (fila.dispositivo_id && fila.dispositivo_id !== dispositivoId)))) throw denegar();
    await tx.query("UPDATE credencial SET estado='activa',dispositivo_id=$2,activada_en=COALESCE(activada_en,now()) WHERE id=$1", [fila.id, dispositivoId ?? null]);
    const datos: IdentidadJwt = { cuentaId: fila.cuenta_id, credencialId: fila.id, tipo, ...(dispositivoId ? { dispositivoId } : {}) };
    const contexto = await cargarContexto(datos, tx);
    if (!contexto) throw denegar();
    const jwt = await firmarJwt(datos);
    if (tipo === "familia") return { jwt, contexto };
    const tokenRenovacion = generarToken();
    const renovacion = await tx.query<{ ultima_renovacion: Date }>(`INSERT INTO sesion_renovacion(credencial_id,hash_actual,ultima_renovacion,expira_en) VALUES($1,$2,now(),now()+interval '14 days')
      ON CONFLICT(credencial_id) DO UPDATE SET hash_actual=EXCLUDED.hash_actual,hash_anterior=NULL,ultima_renovacion=now(),expira_en=now()+interval '14 days' RETURNING ultima_renovacion`, [fila.id, hashToken(tokenRenovacion)]);
    return { jwt, contexto, tokenRenovacion, ultimaRenovacion: renovacion.rows[0]!.ultima_renovacion.toISOString() };
  });
}
export async function renovar(token: string, dispositivoId: string, pendientes = 0): Promise<SesionAcceso> {
  // El resultado de denegación sale de la transacción para conservar el aviso tras el commit.
  const resultado = await enTransaccion(async tx => {
    const hash = hashToken(token);
    const fila = (await tx.query<FilaCredencial & { hash_actual: Buffer; hash_anterior: Buffer | null; ultima_renovacion: Date; en_ventana: boolean }>(`SELECT cr.*,c.activa,s.hash_actual,s.hash_anterior,s.ultima_renovacion,(now()<=s.expira_en+interval '60 days') en_ventana FROM sesion_renovacion s JOIN credencial cr ON cr.id=s.credencial_id JOIN cuenta c ON c.id=cr.cuenta_id WHERE s.hash_actual=$1 OR s.hash_anterior=$1 FOR UPDATE OF s,cr,c`, [hash])).rows[0];
    if (!fila || fila.dispositivo_id !== dispositivoId) throw denegar();
    if (!fila.activa || fila.estado === "terminada" || !fila.en_ventana) {
      if (pendientes > 0) await tx.query("INSERT INTO aviso_coordinacion(tipo,cuenta_relacionada_id,cantidad,credencial_relacionada_id) VALUES('pendientes_rechazados',$1,$2,$3) ON CONFLICT DO NOTHING", [fila.cuenta_id, pendientes, fila.id]);
      return null;
    }
    const tokenRenovacion = sucesorRenovacion(token);
    let ultima = fila.ultima_renovacion;
    if (hash.equals(fila.hash_actual)) {
      const actualizacion = await tx.query<{ ultima_renovacion: Date }>("UPDATE sesion_renovacion SET hash_anterior=hash_actual,hash_actual=$2,ultima_renovacion=now(),expira_en=now()+interval '14 days' WHERE credencial_id=$1 RETURNING ultima_renovacion", [fila.id, hashToken(tokenRenovacion)]);
      ultima = actualizacion.rows[0]!.ultima_renovacion;
    } else if (!hashToken(tokenRenovacion).equals(fila.hash_actual)) throw denegar();
    const datos: IdentidadJwt = { cuentaId: fila.cuenta_id, credencialId: fila.id, tipo: "equipo", dispositivoId };
    const contexto = await cargarContexto(datos, tx);
    if (!contexto) throw denegar();
    return { jwt: await firmarJwt(datos), contexto, tokenRenovacion, ultimaRenovacion: ultima.toISOString() };
  });
  if (!resultado) throw new ErrorAplicacion(401, "credencial_terminada");
  return resultado;
}
export async function reportarBloqueo(token: string, dispositivoId: string): Promise<void> {
  await enTransaccion(async tx => {
    const hash = hashToken(token);
    const fila = (await tx.query<{ credencial_id: string; dispositivo_id: string }>("SELECT s.credencial_id,cr.dispositivo_id FROM sesion_renovacion s JOIN credencial cr ON cr.id=s.credencial_id WHERE s.hash_actual=$1 OR s.hash_anterior=$1 FOR UPDATE OF s,cr", [hash])).rows[0];
    if (!fila || fila.dispositivo_id !== dispositivoId) throw denegar();
    await tx.query("UPDATE credencial SET estado='terminada',terminada_en=COALESCE(terminada_en,now()),motivo_fin=COALESCE(motivo_fin,'bloqueo_pin') WHERE id=$1", [fila.credencial_id]);
  });
}
