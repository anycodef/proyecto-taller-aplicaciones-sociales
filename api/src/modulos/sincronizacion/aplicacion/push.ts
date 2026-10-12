import { createHash } from "node:crypto";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { rolesEfectivos } from "@/lib/seguridad/contexto-acceso";
import { consolidar } from "@/lib/asistencia/consolidacion";
import { estadoEnSesion } from "@/lib/asistencia/faltas";
import { interpretarCodigoQr } from "@/lib/asistencia/carne";
import { validarCorreccion } from "@/lib/asistencia/correccion";
import { dentroDeVentana, horaEfectiva } from "@/lib/asistencia/reloj";
import { fechaValida, idSesion, ventanaDe } from "@/lib/asistencia/sesiones";
import type { Correccion, Sesion } from "@/lib/asistencia/tipos";
import type { ResumenPush } from "@/lib/sincronizacion/protocolo";
import { enTransaccion, type Tx } from "../../../compartido/bd/transaccion";
import { ErrorAplicacion } from "../../../compartido/http/respuestas";
import { bloquearPares, consolidarPar, revisarCruce } from "../../asistencia/aplicacion/procesar-marcas";
import { obtenerFuenteInscripciones } from "../../asistencia/infraestructura/fuente-inscripciones-pg";
import { crearAviso, leerCorrecciones, leerMarcas, leerParametros, leerSesion, resolverCarneServidor } from "../../asistencia/infraestructura/repositorio-pg";
import { esquemaPush, type EntradaCorreccion, type EntradaLista, type EntradaMarca, type EntradaPush, type EntradaSesion } from "../dominio/validacion";
import { cargarContexto } from "../../seguridad/aplicacion/contexto";
import { actividadYaAplicada, procesarActividad } from "../../actividades/aplicacion/procesar-actividad";
import { bloquearNinosDelPush, referenciasDePendiente, sinVinculoPersonal } from "../../asistencia/infraestructura/privacidad-pendientes";

type Fila = EntradaLista | EntradaMarca | EntradaCorreccion;
type TablaInmutable = "lista_asistencia" | "marca_asistencia" | "correccion_asistencia";
const huella = (fila: Fila | Record<string, unknown>): string => createHash("sha256").update(JSON.stringify(Object.entries(fila).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
const iso = (hora: number): string => new Date(hora).toISOString();
const autorizadoAutor = (fila: Fila | EntradaSesion, autor: string, cuenta: ContextoAcceso): boolean => fila.cuenta_id === cuenta.cuentaId && autor === cuenta.cuentaId && fila.credencial_id === cuenta.credencialId && fila.dispositivo_id === cuenta.dispositivoId;
async function repetida(tabla: TablaInmutable, fila: Fila, tx: Tx, cuenta: ContextoAcceso, retirada = false): Promise<"aceptada" | "rechazada" | null> {
  const resultado = await tx.query<{ huella_peticion: string; estado: "aceptada" | "rechazada" }>(`SELECT huella_peticion,estado FROM ${tabla} WHERE id=$1`, [fila.id]);
  if (!resultado.rows.length) return null;
  const autor = "confirmada_por" in fila ? fila.confirmada_por : "registrado_por" in fila ? fila.registrado_por : fila.corregido_por;
  if (!autorizadoAutor(fila, autor, cuenta)) {
    await crearAviso(tx, { tipo: "rechazo_registro", cicloId: fila.ciclo_id, sesionId: fila.sesion_id, referencia: fila.id, motivo: "autoria_invalida" });
    return "rechazada";
  }
  if (resultado.rows[0].huella_peticion === huella(retirada ? sinVinculoPersonal(fila) : fila)) return resultado.rows[0].estado;
  await crearAviso(tx, { tipo: "colision_id", cicloId: fila.ciclo_id, sesionId: fila.sesion_id, referencia: fila.id });
  return "rechazada";
}
async function guardar(tabla: TablaInmutable, fila: Fila, autor: string, cuenta: ContextoAcceso, motivo: string | null, tx: Tx, ninoId?: string | null, retirada = false): Promise<void> {
  const entradaMinima = retirada ? sinVinculoPersonal(fila) : fila;
  const campos: Record<string, unknown> = { ...entradaMinima, cuenta_id: cuenta.cuentaId, credencial_id: cuenta.credencialId, dispositivo_id: cuenta.dispositivoId,
    estado: motivo ? "rechazada" : "aceptada", motivo_rechazo: motivo, huella_peticion: huella(entradaMinima) };
  if (tabla === "lista_asistencia") {
    campos.confirmada_por = cuenta.cuentaId;
    campos.abierta_en = iso((fila as EntradaLista).abierta_en);
    campos.confirmada_en = iso((fila as EntradaLista).confirmada_en);
  } else {
    campos[autor] = cuenta.cuentaId;
    campos.hora_dispositivo = iso((fila as EntradaMarca | EntradaCorreccion).hora_dispositivo);
    campos.catequizando_id = retirada ? null : ninoId ?? null;
  }
  const columnas = Object.keys(campos);
  await tx.query(`INSERT INTO ${tabla}(${columnas.join(",")}) VALUES(${columnas.map((_, indice) => `$${indice + 1}`).join(",")}) ON CONFLICT(id) DO NOTHING`, Object.values(campos));
  if (motivo) await crearAviso(tx, { tipo: "rechazo_registro", cicloId: fila.ciclo_id, sesionId: fila.sesion_id, referencia: fila.id, marcaId: tabla === "marca_asistencia" ? fila.id : undefined, motivo });
}
async function validarSesion(fila: EntradaSesion, cuenta: ContextoAcceso, tx: Tx): Promise<boolean> {
  if (!rolesEfectivos(cuenta).includes("coordinacion") || !autorizadoAutor(fila, fila.actualizado_por, cuenta)) return false;
  if (!fechaValida(fila.fecha) || fila.id !== idSesion(fila.ciclo_id, fila.fecha, fila.tipo, fila.actividad_id)) return false;
  if (fila.tipo !== "actividad" && new Date(fila.fecha).getUTCDay() !== 0) return false;
  if (fila.cancelada && !fila.motivo_cancelacion?.trim()) return false;
  if ((fila.tipo === "actividad") !== Boolean(fila.actividad_id)) return false;
  if (fila.tipo === "actividad") {
    const actividad = await tx.query("SELECT id FROM actividad_obligatoria WHERE id=$1 AND ciclo_id=$2 AND fecha=$3 AND estado<>'cancelada'", [fila.actividad_id, fila.ciclo_id, fila.fecha]);
    if (!actividad.rowCount) return false;
  }
  const ciclo = await tx.query("SELECT id FROM ciclo WHERE id=$1 AND $2::date BETWEEN inicio AND fin", [fila.ciclo_id, fila.fecha]);
  if (!ciclo.rowCount) return false;
  const ventana = ventanaDe({ id: fila.id, cicloId: fila.ciclo_id, fecha: fila.fecha, tipo: fila.tipo, actividadId: fila.actividad_id, cancelada: fila.cancelada, ventanaInicio: fila.ventana_inicio, ventanaFin: fila.ventana_fin }, await leerParametros(fila.ciclo_id, tx));
  if (ventana.inicio >= ventana.fin) return false;
  return true;
}
async function motivoBase(fila: Fila, autor: string, cuenta: ContextoAcceso, tx: Tx): Promise<{ motivo: string | null; sesion?: Sesion }> {
  if (!autorizadoAutor(fila, autor, cuenta)) return { motivo: "autoria_invalida" };
  const sesion = await leerSesion(fila.sesion_id, tx);
  if (!sesion || sesion.cicloId !== fila.ciclo_id) return { motivo: "sesion_invalida" };
  if (sesion.cancelada) return { motivo: "sesion_cancelada", sesion };
  if (sesion.actividadId) {
    const actividad = await tx.query("SELECT id FROM actividad_obligatoria WHERE id=$1 AND estado<>'cancelada'", [sesion.actividadId]);
    if (!actividad.rowCount) return { motivo: "actividad_cancelada", sesion };
  }
  return { motivo: null, sesion };
}
export async function aplicarPush(entradaDesconocida: unknown, cuenta: ContextoAcceso, tx: Tx): Promise<ResumenPush> {
  const validada = esquemaPush.safeParse(entradaDesconocida);
  if (!validada.success) throw new ErrorAplicacion(422, "esquema_sincronizacion_invalido");
  const entrada: EntradaPush = validada.data;
  for (const [tabla, cambios] of Object.entries(entrada.changes)) {
    if (cambios && (cambios.deleted.length || (!["sesiones", "actividades_obligatorias"].includes(tabla) && cambios.updated.length))) throw new ErrorAplicacion(422, "historia_inmutable");
  }
  if (!cuenta.dispositivoId || !rolesEfectivos(cuenta).some(rol => rol === "catequista" || rol === "coordinacion")) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const vigente = await tx.query<{ activada_en: Date | null }>("SELECT cr.activada_en FROM cuenta c JOIN credencial cr ON cr.cuenta_id=c.id WHERE c.id=$1 AND c.activa AND cr.id=$2 AND cr.estado='activa' AND cr.dispositivo_id=$3 FOR SHARE OF c,cr", [cuenta.cuentaId, cuenta.credencialId, cuenta.dispositivoId]);
  if (!vigente.rowCount) throw new ErrorAplicacion(401, "acceso_denegado");
  const inicioCredencial = vigente.rows[0].activada_en?.getTime() ?? 0;
  const actual = await cargarContexto({ cuentaId: cuenta.cuentaId, credencialId: cuenta.credencialId, tipo: "equipo", dispositivoId: cuenta.dispositivoId }, tx);
  if (!actual) throw new ErrorAplicacion(401, "acceso_denegado");
  cuenta = actual;
  if (!rolesEfectivos(cuenta).some(rol => rol === "catequista" || rol === "coordinacion")) throw new ErrorAplicacion(403, "fuera_de_alcance");
  const resumen: ResumenPush = { aceptados: 0, rechazados: 0, descartadosCierre: 0 };
  const actividades = [...(entrada.changes.actividades_obligatorias?.created ?? []), ...(entrada.changes.actividades_obligatorias?.updated ?? [])];
  const sesiones = [...(entrada.changes.sesiones?.created ?? []), ...(entrada.changes.sesiones?.updated ?? [])];
  const listas = entrada.changes.listas_asistencia?.created ?? [];
  const marcas = entrada.changes.marcas_asistencia?.created ?? [];
  const correcciones = entrada.changes.correcciones_asistencia?.created ?? [];
  const todas = [...actividades, ...sesiones, ...listas, ...marcas, ...correcciones];
  if (new Set(todas.map(fila => fila.id)).size !== todas.length) throw new ErrorAplicacion(422, "ids_repetidos_en_lote");
  const ciclosAbiertos = new Set<string>();
  for (const cicloId of [...new Set(todas.map(fila => fila.ciclo_id))].sort()) {
    const ciclo = await tx.query<{ estado: string }>("SELECT estado FROM ciclo WHERE id=$1 FOR SHARE", [cicloId]);
    if (!ciclo.rowCount) throw new ErrorAplicacion(422, "ciclo_invalido");
    if (ciclo.rows[0].estado === "abierto") ciclosAbiertos.add(cicloId);
  }
  resumen.descartadosCierre = todas.filter(fila => !ciclosAbiertos.has(fila.ciclo_id)).length;
  for (const fila of actividades.filter(fila => !ciclosAbiertos.has(fila.ciclo_id))) {
    const operacion = entrada.changes.actividades_obligatorias?.created.some(creada => creada.id === fila.id) ? "crear" : "actualizar";
    if (await actividadYaAplicada(fila, operacion, cuenta, tx)) { resumen.aceptados++; resumen.descartadosCierre--; }
  }
  const operativas = [...marcas, ...correcciones].filter(fila => ciclosAbiertos.has(fila.ciclo_id));
  const estadosNinos = await bloquearNinosDelPush([...ciclosAbiertos].sort(), [...new Set(operativas.flatMap(referenciasDePendiente))].sort(), tx);
  const esRetirada = (fila: EntradaMarca | EntradaCorreccion): boolean => referenciasDePendiente(fila).some(id => estadosNinos.get(id) === "anonimizado");
  // Todos los locks se adquieren en el mismo orden, incluidos los reenvíos de ids.
  for (const clave of [...new Set(todas.filter(fila => ciclosAbiertos.has(fila.ciclo_id)).map(fila => `lote:${fila.id}`))].sort()) await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [clave]);
  const fechas = new Map<string, string>();
  for (const fila of [...listas, ...marcas, ...correcciones].filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    const sesion = await leerSesion(fila.sesion_id, tx);
    if (sesion) fechas.set(`${sesion.cicloId}:${sesion.fecha}`, sesion.fecha);
  }
  for (const fila of sesiones.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) fechas.set(`${fila.ciclo_id}:${fila.fecha}`, fila.fecha);
  for (const fila of actividades.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    fechas.set(`${fila.ciclo_id}:${fila.fecha}`, fila.fecha);
    const anterior = await tx.query<{ fecha: string }>("SELECT fecha::text FROM actividad_obligatoria WHERE id=$1", [fila.id]);
    if (anterior.rows[0]) fechas.set(`${fila.ciclo_id}:${anterior.rows[0].fecha}`, anterior.rows[0].fecha);
  }
  for (const clave of [...fechas.keys()].sort()) await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`domingo:${clave}`]);
  for (const fila of actividades.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    const operacion = entrada.changes.actividades_obligatorias?.created.some(creada => creada.id === fila.id) ? "crear" : "actualizar";
    const aceptada = await procesarActividad(fila, operacion, cuenta, tx);
    resumen[aceptada ? "aceptados" : "rechazados"]++;
  }
  for (const fila of sesiones.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    if (!(await validarSesion(fila, cuenta, tx))) {
      resumen.rechazados++;
      await crearAviso(tx, { tipo: "rechazo_sesion", cicloId: fila.ciclo_id, sesionId: fila.id, referencia: fila.id });
      continue;
    }
    await tx.query(`INSERT INTO sesion(id,ciclo_id,fecha,tipo,actividad_id,ventana_inicio,ventana_fin,cancelada,motivo_cancelacion,actualizado_por,cuenta_id,credencial_id,dispositivo_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET ventana_inicio=EXCLUDED.ventana_inicio,ventana_fin=EXCLUDED.ventana_fin,cancelada=EXCLUDED.cancelada,motivo_cancelacion=EXCLUDED.motivo_cancelacion,actualizado_por=EXCLUDED.actualizado_por,cuenta_id=EXCLUDED.cuenta_id,credencial_id=EXCLUDED.credencial_id,dispositivo_id=EXCLUDED.dispositivo_id`,
    [fila.id, fila.ciclo_id, fila.fecha, fila.tipo, fila.actividad_id ?? null, fila.ventana_inicio ?? null, fila.ventana_fin ?? null, fila.cancelada, fila.motivo_cancelacion ?? null, cuenta.cuentaId, cuenta.credencialId, cuenta.dispositivoId]);
    resumen.aceptados++;
  }
  const ahora = Date.now();
  const listasAceptadas = new Set<string>();
  for (const fila of listas.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    const repeticion = await repetida("lista_asistencia", fila, tx, cuenta);
    if (repeticion) { resumen[repeticion === "aceptada" ? "aceptados" : "rechazados"]++; if (repeticion === "aceptada") listasAceptadas.add(fila.id); continue; }
    const base = await motivoBase(fila, fila.confirmada_por, cuenta, tx);
    let motivo = base.motivo;
    if (!rolesEfectivos(cuenta).includes("catequista")) motivo = "rol_no_autorizado";
    if (!motivo && base.sesion) {
      const efectiva = horaEfectiva(iso(fila.confirmada_en), fila.desfase_reloj_ms);
      const parametros = await leerParametros(fila.ciclo_id, tx);
      if (base.sesion.tipo === "misa" || efectiva > ahora || efectiva < inicioCredencial || fila.abierta_en > fila.confirmada_en || !dentroDeVentana(efectiva, ventanaDe(base.sesion, parametros), parametros.toleranciaRelojMin)) motivo = "lista_fuera_de_ventana";
      const activos = (await obtenerFuenteInscripciones().activosEnFecha(fila.ciclo_id, base.sesion.fecha, tx)).filter(nino => nino.grupoId === fila.grupo_id);
      const miembros = marcas.filter(marca => marca.lista_id === fila.id);
      const ids = miembros.map(marca => marca.catequizando_id);
      if (!activos.length || ids.length !== activos.length || new Set(ids).size !== ids.length || activos.some(nino => !ids.includes(nino.catequizandoId)) || miembros.some(marca => marca.tipo_registro !== "lista" || Boolean(marca.codigo_leido) || marca.sesion_id !== fila.sesion_id || marca.ciclo_id !== fila.ciclo_id || marca.hora_dispositivo !== fila.confirmada_en || marca.desfase_reloj_ms !== fila.desfase_reloj_ms || !autorizadoAutor(marca, marca.registrado_por, cuenta)) || fila.total_presentes !== miembros.filter(marca => marca.valor === "presente").length || fila.total_ausentes !== miembros.filter(marca => marca.valor === "ausente").length) motivo = "lista_incompleta";
    }
    await guardar("lista_asistencia", fila, "confirmada_por", cuenta, motivo, tx);
    resumen[motivo ? "rechazados" : "aceptados"]++;
    if (!motivo) listasAceptadas.add(fila.id);
  }
  const resueltas = new Map<string, string | null>();
  for (const fila of marcas.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    let ninoId = fila.catequizando_id;
    if (fila.tipo_registro === "escaneo") {
      ninoId = interpretarCodigoQr(fila.codigo_leido ?? "")?.catequizandoId ?? null;
    }
    resueltas.set(fila.id, ninoId);
  }
  await bloquearPares([...marcas.filter(fila => ciclosAbiertos.has(fila.ciclo_id)).map(fila => ({ sesionId: fila.sesion_id, catequizandoId: resueltas.get(fila.id) ?? "" })), ...correcciones.filter(fila => ciclosAbiertos.has(fila.ciclo_id)).map(fila => ({ sesionId: fila.sesion_id, catequizandoId: fila.catequizando_id }))].filter(par => par.catequizandoId), tx);
  const afectados = new Map<string, { sesionId: string; catequizandoId: string }>();
  for (const fila of marcas.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    const retirada = esRetirada(fila);
    const repeticion = await repetida("marca_asistencia", fila, tx, cuenta, retirada);
    if (repeticion) { resumen[repeticion === "aceptada" ? "aceptados" : "rechazados"]++; continue; }
    const base = await motivoBase(fila, fila.registrado_por, cuenta, tx);
    let motivo = base.motivo;
    let ninoId = resueltas.get(fila.id) ?? null;
    if (!rolesEfectivos(cuenta).includes("catequista")) motivo = "rol_no_autorizado";
    if (!motivo && base.sesion) {
      const parametros = await leerParametros(fila.ciclo_id, tx);
      const hora = horaEfectiva(iso(fila.hora_dispositivo), fila.desfase_reloj_ms);
      if (hora > ahora || hora < inicioCredencial || !dentroDeVentana(hora, ventanaDe(base.sesion, parametros), parametros.toleranciaRelojMin)) motivo = "hora_fuera_de_ventana";
      const activos = await obtenerFuenteInscripciones().activosEnFecha(fila.ciclo_id, base.sesion.fecha, tx);
      const nino = activos.find(nino => nino.catequizandoId === ninoId);
      if (!nino) motivo = "nino_inactivo_en_fecha";
      if (fila.tipo_registro === "escaneo") {
        const carne = await resolverCarneServidor(fila.codigo_leido ?? "", tx);
        if (carne.estado === "invalido" || !ninoId || (fila.catequizando_id && fila.catequizando_id !== ninoId)) motivo = "carne_invalido";
      }
      if (fila.tipo_registro !== "lista" && (fila.valor !== "presente" || base.sesion.tipo === "catequesis" || fila.lista_id)) motivo = "tipo_registro_invalido";
      if (fila.tipo_registro === "manual" && (!nino || !cuenta.gruposAsignados.includes(nino.grupoId))) motivo = "manual_fuera_de_alcance";
      if (fila.tipo_registro === "lista" && (!fila.lista_id || !listasAceptadas.has(fila.lista_id))) motivo = "lista_no_confirmada";
      if (fila.tipo_registro !== "escaneo" && fila.codigo_leido) motivo = "codigo_no_permitido";
      if (fila.tipo_registro === "lista" && fila.lista_id) {
        const lista = listas.find(lista => lista.id === fila.lista_id);
        if (!lista || lista.grupo_id !== nino?.grupoId || lista.sesion_id !== fila.sesion_id || lista.ciclo_id !== fila.ciclo_id || lista.confirmada_en !== fila.hora_dispositivo || lista.desfase_reloj_ms !== fila.desfase_reloj_ms) motivo = "miembro_fuera_de_lista";
        const anterior = await tx.query("SELECT id FROM marca_asistencia WHERE lista_id=$1 AND catequizando_id=$2 AND estado='aceptada'", [fila.lista_id, ninoId]);
        if (anterior.rowCount) motivo = "miembro_lista_ya_registrado";
        if (lista) {
          const cantidad = await tx.query<{ cantidad: number }>("SELECT count(*)::integer AS cantidad FROM marca_asistencia WHERE lista_id=$1 AND estado='aceptada'", [fila.lista_id]);
          if (cantidad.rows[0].cantidad >= lista.total_presentes + lista.total_ausentes) motivo = "lista_ya_completa";
        }
      }
    }
    if (ninoId && !estadosNinos.has(ninoId)) { ninoId = null; motivo = "nino_inactivo_en_fecha"; }
    if (retirada) { motivo = "nino_inactivo"; ninoId = null; }
    await guardar("marca_asistencia", fila, "registrado_por", cuenta, motivo, tx, ninoId, retirada);
    resumen[motivo ? "rechazados" : "aceptados"]++;
    if (!motivo && ninoId) afectados.set(`${fila.sesion_id}:${ninoId}`, { sesionId: fila.sesion_id, catequizandoId: ninoId });
  }
  for (const fila of correcciones.filter(fila => ciclosAbiertos.has(fila.ciclo_id))) {
    const retirada = esRetirada(fila);
    const repeticion = await repetida("correccion_asistencia", fila, tx, cuenta, retirada);
    if (repeticion) { resumen[repeticion === "aceptada" ? "aceptados" : "rechazados"]++; continue; }
    const base = await motivoBase(fila, fila.corregido_por, cuenta, tx);
    let motivo = base.motivo;
    const marcasPar = await leerMarcas(fila.sesion_id, fila.catequizando_id, tx);
    const anteriores = await leerCorrecciones(fila.sesion_id, fila.catequizando_id, tx);
    const actual = consolidar(marcasPar, anteriores);
    if (!motivo && base.sesion) {
      const correccion: Correccion = { id: fila.id, cicloId: fila.ciclo_id, sesionId: fila.sesion_id, catequizandoId: fila.catequizando_id, valorAnterior: fila.valor_anterior, valorNuevo: fila.valor_nuevo, motivo: fila.motivo, corregidoPor: fila.corregido_por, credencialId: fila.credencial_id, horaDispositivo: iso(fila.hora_dispositivo), desfaseRelojMs: fila.desfase_reloj_ms, recibidoEn: iso(ahora), estado: "aceptada" };
      const parametros = await leerParametros(fila.ciclo_id, tx);
      const hora = horaEfectiva(correccion.horaDispositivo, correccion.desfaseRelojMs);
      const nino = (await obtenerFuenteInscripciones().activosEnFecha(fila.ciclo_id, base.sesion.fecha, tx)).find(nino => nino.catequizandoId === fila.catequizando_id);
      const lista = nino ? await tx.query("SELECT id FROM lista_asistencia WHERE sesion_id=$1 AND grupo_id=$2 AND estado='aceptada' AND eliminado_en IS NULL LIMIT 1", [fila.sesion_id, nino.grupoId]) : null;
      const estadoAnterior = estadoEnSesion(base.sesion, Boolean(nino), actual?.valor, Boolean(lista?.rowCount), hora, parametros);
      motivo = validarCorreccion(correccion, cuenta, marcasPar.map(marca => marca.registradoPor), base.sesion.fecha, ahora, parametros);
      if (hora < inicioCredencial) motivo = "hora_antes_credencial";
      if (estadoAnterior !== fila.valor_anterior) motivo = "valor_anterior_invalido";
      if (!nino) motivo = "nino_inactivo_en_fecha";
    }
    if (retirada) motivo = "nino_inactivo";
    await guardar("correccion_asistencia", fila, "corregido_por", cuenta, motivo, tx, estadosNinos.has(fila.catequizando_id) ? fila.catequizando_id : null, retirada);
    resumen[motivo ? "rechazados" : "aceptados"]++;
    if (!motivo) afectados.set(`${fila.sesion_id}:${fila.catequizando_id}`, { sesionId: fila.sesion_id, catequizandoId: fila.catequizando_id });
  }
  for (const par of afectados.values()) await consolidarPar(par.sesionId, par.catequizandoId, tx);
  for (const clave of fechas.keys()) await revisarCruce(clave.slice(0, 36), clave.slice(37), tx);
  return resumen;
}
export const push = (entrada: unknown, cuenta: ContextoAcceso): Promise<ResumenPush> => enTransaccion(tx => aplicarPush(entrada, cuenta, tx));
