import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { idAsistencia, idAviso, idSesion, domingosDelCiclo, finDelDomingo, ventanaDe } from "@/lib/asistencia/sesiones";
import { dentroDeVentana, estimarDesfase, horaEfectiva } from "@/lib/asistencia/reloj";
import { interpretarCodigoQr, resolverCarne } from "@/lib/asistencia/carne";
import { puedeConfigurarSesiones, puedeEscanear, puedePasarLista, puedeRegistrarManual } from "@/lib/asistencia/autorizacion";
import { procesarEscaneo } from "@/lib/asistencia/escaneo";
import { abrirLista, alternar, confirmarLista } from "@/lib/asistencia/lista";
import { consolidar } from "@/lib/asistencia/consolidacion";
import { validarCorreccion } from "@/lib/asistencia/correccion";
import { estadoEnSesion, faltasDelCiclo } from "@/lib/asistencia/faltas";
import { detectarMisaSinCatequesis } from "@/lib/asistencia/revision-cruzada";
import { armarReporteMisa } from "@/lib/asistencia/reporte-misa";
import type { Correccion, MarcaAsistencia, NinoNomina, Sesion } from "@/lib/asistencia/tipos";
import { contarPendientes } from "@/lib/sincronizacion/pendientes";
import { huellaAlcance, filtroPull, requiereReemplazo } from "@/lib/sincronizacion/alcance";
import { debeSincronizar, esperaReintento } from "@/lib/sincronizacion/orquestador";
import { tablasAsistencia } from "@/lib/asistencia/tablas-sincronizadas";
import { validarColumnas } from "@/lib/sincronizacion/columnas-prohibidas";
import { aEnvoltorioEspanol } from "@/lib/sincronizacion/protocolo";
import { esquemaPush } from "../../../src/modulos/sincronizacion/dominio/validacion";

const ninoId = "42181323-e2ad-4e17-bd8a-93eb7178bc5b";
const cuenta: ContextoAcceso = { cuentaId: "21a3b98c-b26a-4a42-a437-ad6a037d50eb", credencialId: "4ff933fc-6d59-44c3-8921-c0b24901a292", dispositivoId: "40d0939d-51e3-410d-bd4f-7e581b9c762e", rolesPropios: ["catequista"], gruposAsignados: ["propio"], catequizandosApoderados: [], identidadOperativa: "Luz 7", esMenor: true };
const sesion: Sesion = { id: "misa", cicloId: "ciclo", fecha: "2026-10-11", tipo: "misa", cancelada: false };
const catequesis: Sesion = { ...sesion, id: "catequesis", tipo: "catequesis" };
const nino = { id: ninoId, nombres: "Ana", apellidos: "Prueba", grupoId: "propio", codigoCarne: `SGC1:${ninoId}:1`, activo: true } satisfies NinoNomina;
const marca: MarcaAsistencia = { id: "marca-1", cicloId: "ciclo", sesionId: "misa", catequizandoId: ninoId, valor: "presente", tipoRegistro: "escaneo", registradoPor: cuenta.cuentaId, credencialId: cuenta.credencialId, dispositivoId: cuenta.dispositivoId!, horaDispositivo: "2026-10-11T08:00:00-05:00", desfaseRelojMs: 0, recibidoEn: "2026-10-18T13:00:00Z", estado: "aceptada" };
const correccion: Correccion = { id: "correccion-1", cicloId: "ciclo", sesionId: "misa", catequizandoId: ninoId, valorAnterior: "presente", valorNuevo: "ausente", corregidoPor: cuenta.cuentaId, credencialId: cuenta.credencialId, horaDispositivo: "2026-10-11T10:00:00-05:00", desfaseRelojMs: 0, recibidoEn: "2026-10-18T13:00:01Z", estado: "aceptada" };
const escanear = (cambios: Partial<Parameters<typeof procesarEscaneo>[0]> = {}) => procesarEscaneo({ cuenta, sesion, codigo: nino.codigoCarne, nomina: [nino], conConexion: true, existentes: [], id: "nueva", horaDispositivo: marca.horaDispositivo, desfaseRelojMs: 0, ...cambios });

test("RF-301: domingos y UUID v5 de sesiones, consolidado y aviso son deterministas y separados", () => {
  expect(domingosDelCiclo("2026-10-01", "2026-10-31")).toEqual(["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"]);
  expect(idSesion("ciclo", sesion.fecha, "misa")).toBe(idSesion("ciclo", sesion.fecha, "misa"));
  expect(idSesion("ciclo", sesion.fecha, "misa")).not.toBe(idSesion("ciclo", sesion.fecha, "catequesis"));
  expect(idAsistencia("misa", ninoId)).not.toBe(idAviso("conflicto", "misa", ninoId));
  expect(() => domingosDelCiclo("2026-02-30", "2026-10-11")).toThrow();
  expect(estadoEnSesion({ ...sesion, cancelada: true }, true, "presente", false, Date.now())).toBe("no_aplica");
});
test("RF-302: reloj adelantado/atrasado, ventana Lima y tolerancia de diez minutos", () => {
  expect(ventanaDe(sesion)).toEqual({ inicio: Date.parse("2026-10-11T12:30:00Z"), fin: Date.parse("2026-10-11T14:30:00Z") });
  expect(horaEfectiva("2026-10-11T09:00:00-05:00", -3600000)).toBe(Date.parse(marca.horaDispositivo));
  expect(horaEfectiva("2026-10-11T07:00:00-05:00", 3600000)).toBe(Date.parse(marca.horaDispositivo));
  expect(estimarDesfase(2000, 1000, 1200)).toBe(900);
  expect(dentroDeVentana(Date.parse("2026-10-11T09:40:00-05:00"), ventanaDe(sesion))).toBe(true);
  expect(dentroDeVentana(Date.parse("2026-10-11T09:40:01-05:00"), ventanaDe(sesion))).toBe(false);
  expect(() => horaEfectiva("inválida", 0)).toThrow();
  expect(() => horaEfectiva(marca.horaDispositivo, Infinity)).toThrow();
});
test("RF-302 RNF-307: escaneo síncrono no expone nombre de otro grupo y el doble escaneo no crea marca", () => {
  const resultado = escanear({ nomina: [{ ...nino, grupoId: "ajeno" }] });
  expect(resultado).toMatchObject({ resultado: "registrado", mostrarNombre: false, marca: { registradoPor: cuenta.cuentaId, credencialId: cuenta.credencialId, horaDispositivo: marca.horaDispositivo } });
  expect(escanear({ existentes: [{ ...marca, codigoLeido: nino.codigoCarne }] })).toEqual({ resultado: "ya_registrado", mostrarNombre: true });
  expect(escanear({ horaDispositivo: "2026-10-11T12:00:00-05:00" }).resultado).toBe("fuera_de_ventana");
  expect(puedeEscanear({ ...cuenta, rolesPropios: ["coordinacion"] })).toBe(false);
});
test("RF-303: QR estricto, reemisión invalida el anterior, desconocido offline se conserva pendiente", () => {
  expect(interpretarCodigoQr(nino.codigoCarne)).toEqual({ catequizandoId: ninoId, emision: 1 });
  for (const texto of [ninoId, `SGC2:${ninoId}:1`, `sgc1:${ninoId}:1`, `SGC1:${ninoId}:0`, `SGC1:${ninoId}:01`, `SGC1:${ninoId}:1.5`, `SGC1:${ninoId}:2147483648`, `SGC1:${ninoId}:9007199254740992`, `${nino.codigoCarne}\n`]) expect(interpretarCodigoQr(texto)).toBeNull();
  expect(resolverCarne(nino.codigoCarne, [{ ...nino, codigoCarne: `SGC1:${ninoId}:2` }]).estado).toBe("desconocido");
  expect(escanear({ nomina: [{ ...nino, activo: false }] }).resultado).toBe("rechazado");
  expect(escanear({ nomina: [], conConexion: false, codigo: "ilegible" })).toMatchObject({ resultado: "pendiente_validacion", marca: { codigoLeido: "ilegible", catequizandoId: null } });
});
test("RF-304: registro manual exige CAT y grupo propio; reporte cuenta manuales", () => {
  expect(puedeRegistrarManual(cuenta, nino)).toBe(true);
  expect(puedeRegistrarManual(cuenta, { grupoId: "ajeno" })).toBe(false);
  expect(puedeRegistrarManual({ ...cuenta, rolesPropios: ["familia"] }, nino)).toBe(false);
  const consolidada = consolidar([{ ...marca, tipoRegistro: "manual" }])!;
  expect(armarReporteMisa([{ ...consolidada, catequizandoId: ninoId, nombre: "Ana" }], 25, () => "Luz 7").totalManuales).toBe(1);
});
test("RF-305: ausencia solo tras cierre de ventana y la inscripción histórica inactiva no aplica", () => {
  expect(estadoEnSesion(sesion, true, undefined, false, Date.parse("2026-10-11T09:29:59-05:00"))).toBe("pendiente");
  expect(estadoEnSesion(sesion, true, undefined, false, Date.parse("2026-10-11T09:30:01-05:00"))).toBe("ausente");
  expect(estadoEnSesion(sesion, false, undefined, false, Date.now())).toBe("no_aplica");
});
test("RF-306 RNF-301: lista global de 25 abre presente, alterna y confirma un registro por niño", () => {
  let borrador = abrirLista(Array.from({ length: 25 }, (_, indice) => ({ id: `nino-${indice}` })));
  expect(Object.values(borrador).every(valor => valor === "presente")).toBe(true);
  borrador = alternar(borrador, "nino-0");
  expect(alternar(borrador, "nino-0")["nino-0"]).toBe("presente");
  let contador = 0;
  const resultado = confirmarLista({ borrador, cuenta, sesion: catequesis, grupoId: "ajeno", id: "lista", generarId: () => `marca-${++contador}`, abiertaEn: marca.horaDispositivo, hora: "2026-10-11T10:00:00-05:00", desfaseRelojMs: 0 });
  expect(resultado.lista).toMatchObject({ totalPresentes: 24, totalAusentes: 1, grupoId: "ajeno" });
  expect(resultado.marcas).toHaveLength(25);
  expect(puedePasarLista(cuenta)).toBe(true);
  expect(estadoEnSesion(catequesis, true, undefined, false, Date.now())).toBe("sin_registro");
  expect(estadoEnSesion(catequesis, true, undefined, true, Date.now())).toBe("ausente");
});
test("RF-307 RNF-302: reconexión automática, exclusión mutua, reintentos y pendientes por cuenta/credencial", () => {
  expect(esperaReintento(2)).toBe(4000);
  expect(esperaReintento(20)).toBe(300000);
  for (const evento of ["reconexion", "primer_plano", "lista_confirmada", "escaneo"] as const) expect(debeSincronizar(evento, { conConexion: true, enCurso: false, sesionVigente: true })).toBe(true);
  expect(debeSincronizar("reconexion", { conConexion: true, enCurso: true, sesionVigente: true })).toBe(false);
  expect(debeSincronizar("escaneo", { conConexion: false, enCurso: false, sesionVigente: true })).toBe(false);
  expect(contarPendientes([{ _status: "created", cuenta_id: "a", credencial_id: "1" }, { _status: "updated", cuenta_id: "b" }, { _status: "synced", cuenta_id: "a" }, { _status: "created", cuenta_id: "a", credencial_id: "2" }], "a", "1")).toBe(1);
});
test("RF-308: presente gana, autores distintos dejan conflicto y marcas rechazadas no participan", () => {
  const ausencia = { ...marca, id: "ausencia", valor: "ausente" as const, registradoPor: "otro", tipoRegistro: "lista" as const };
  const resultado = consolidar([ausencia, marca]);
  expect(resultado).toMatchObject({ valor: "presente", conflicto: true, tipoRegistro: "escaneo", registradores: [cuenta.cuentaId, "otro"].sort() });
  expect(consolidar([marca, { ...ausencia, registradoPor: cuenta.cuentaId }])?.conflicto).toBe(false);
  expect(consolidar([{ ...marca, estado: "rechazada" }, ausencia])?.valor).toBe("ausente");
});
test("RF-309: corrección tardía en llegar respeta hora efectiva y exige autor o COORD con motivo", () => {
  expect(finDelDomingo(sesion.fecha)).toBe(Date.parse("2026-10-12T04:59:59Z"));
  expect(validarCorreccion(correccion, cuenta, [cuenta.cuentaId], sesion.fecha, Date.parse(correccion.recibidoEn))).toBeNull();
  expect(validarCorreccion(correccion, cuenta, ["otro"], sesion.fecha, Date.parse(correccion.recibidoEn))).toBe("correccion_no_autorizada");
  const posterior = { ...correccion, horaDispositivo: "2026-10-12T10:00:00-05:00" };
  const coordinacion = { ...cuenta, rolesPropios: ["coordinacion" as const] };
  expect(validarCorreccion(posterior, coordinacion, [], sesion.fecha, Date.parse(correccion.recibidoEn))).toBe("correccion_no_autorizada");
  expect(validarCorreccion({ ...posterior, motivo: "Corrección verificada" }, coordinacion, [], sesion.fecha, Date.parse(correccion.recibidoEn))).toBeNull();
  expect(puedeConfigurarSesiones({ ...cuenta, rolesPropios: [], delegacionVigente: { id: "delegacion", hasta: "2026-10-30" } })).toBe(true);
  expect(consolidar([marca], [{ ...correccion, id: "a", valorNuevo: "presente" }, { ...correccion, id: "b", valorNuevo: "ausente" }])?.valor).toBe("ausente");
  expect(consolidar([marca], [{ ...correccion, id: "z", recibidoEn: "2026-10-18T13:00:01.000001Z", valorNuevo: "presente" }, { ...correccion, id: "a", recibidoEn: "2026-10-18T13:00:01.000002Z", valorNuevo: "ausente" }])?.valor).toBe("ausente");
});
test("RF-309 RF-312: correcciones aceptadas sin marcas consolidan manual con autoría y horas reales de corrección", () => {
  const primera: Correccion = { ...correccion, valorAnterior: "sin_registro", valorNuevo: "presente", corregidoPor: "coordinacion-uno", horaDispositivo: "2026-10-12T10:00:00-05:00", recibidoEn: "2026-10-12T15:00:01.000001Z" };
  const ultima: Correccion = { ...primera, id: "segunda", valorAnterior: "presente", valorNuevo: "ausente", corregidoPor: "coordinacion-dos", horaDispositivo: "2026-10-12T11:00:00-05:00", recibidoEn: "2026-10-12T16:00:01.000001Z" };
  expect(consolidar([], [ultima, primera])).toEqual({ valor: "ausente", tipoRegistro: "manual", horaPrimerRegistro: primera.horaDispositivo, recibidoPrimerRegistro: primera.recibidoEn, registradores: ["coordinacion-dos", "coordinacion-uno"], conflicto: false, corregida: true });
  expect(consolidar([], [{ ...primera, estado: "rechazada" }])).toBeNull();
  expect(consolidar([], [])).toBeNull();
});
test("RF-310: revisión cruzada exige lista confirmada y presencia misa/ausencia catequesis", () => {
  const misa = [{ catequizandoId: ninoId, valor: "presente" }], lista = [{ catequizandoId: ninoId, valor: "ausente" }];
  expect(detectarMisaSinCatequesis(misa, lista, true)).toEqual([ninoId]);
  expect(detectarMisaSinCatequesis(misa, lista, false)).toEqual([]);
});
test("RF-311: falta doble domingo, sin registro/cancelada no suman y jornada cuenta aparte con justificación", () => {
  const filas = [{ sesion, catequizandoId: ninoId, estado: "ausente" as const }, { sesion: catequesis, catequizandoId: ninoId, estado: "ausente" as const }];
  expect(faltasDelCiclo(filas)).toHaveLength(1);
  for (const estado of ["presente", "sin_registro", "no_aplica", "pendiente"] as const) expect(faltasDelCiclo([filas[0], { ...filas[1], estado }])).toEqual([]);
  expect(faltasDelCiclo([filas[0]])).toEqual([]);
  const jornada = { sesion: { ...sesion, id: "jornada", tipo: "actividad" as const, tipoActividad: "jornada" }, catequizandoId: ninoId, estado: "ausente" as const };
  expect(faltasDelCiclo([...filas, jornada])).toHaveLength(2);
  expect(faltasDelCiclo([...filas, jornada], [{ catequizandoId: ninoId, fecha: sesion.fecha }]).every(falta => falta.justificada)).toBe(true);
  expect(faltasDelCiclo([{ ...jornada, sesion: { ...jornada.sesion, tipoActividad: "retiro" } }])).toEqual([]);
});
test("RF-312: reporte conserva ambos registradores solo con identidad operativa y denominador histórico", () => {
  const consolidada = consolidar([marca, { ...marca, id: "otra", registradoPor: "otro" }])!;
  expect(armarReporteMisa([{ ...consolidada, catequizandoId: ninoId, nombre: "Ana" }], 97, id => id === "otro" ? "Luz 8" : "Luz 7")).toMatchObject({ totalActivos: 97, totalPresentes: 1, presentes: [{ registradores: ["Luz 7", "Luz 8"], horaDispositivo: marca.horaDispositivo, recibidoEn: marca.recibidoEn }] });
});
test("RF-313: actividades de la misma fecha tienen sesiones diferentes y ventana de día completo", () => {
  expect(idSesion("ciclo", sesion.fecha, "actividad", "a")).not.toBe(idSesion("ciclo", sesion.fecha, "actividad", "b"));
  expect(ventanaDe({ ...sesion, tipo: "actividad" })).toEqual({ inicio: Date.parse("2026-10-11T05:00:00Z"), fin: Date.parse("2026-10-12T04:59:59Z") });
  expect(escanear({ sesion: { ...sesion, tipo: "actividad" } }).resultado).toBe("registrado");
});
test("RNF-306 Principio 7: nómina mínima global y datos operativos filtrados, huella cambia con alcance", () => {
  for (const tabla of tablasAsistencia) expect(() => validarColumnas(tabla)).not.toThrow();
  const nomina = tablasAsistencia.find(tabla => tabla.nombre === "catequizandos")!;
  expect(Object.keys(nomina.columnas).sort()).toEqual(["activo", "apellidos", "codigo_carne", "grupo_id", "nombres"]);
  expect(filtroPull(nomina, cuenta).tipo).toBe("ciclo");
  expect(filtroPull(tablasAsistencia.find(tabla => tabla.nombre === "asistencias")!, cuenta)).toEqual({ tipo: "mis_grupos", ids: ["propio"] });
  expect(() => validarColumnas({ ...nomina, columnas: { fecha_nacimiento: "string" } })).toThrow();
  expect(requiereReemplazo(huellaAlcance(cuenta), huellaAlcance({ ...cuenta, gruposAsignados: ["nuevo"] }))).toBe(true);
});
test("RF-307 RNF-304: transporte nativo mantiene filas snake_case y domingo de 25 niños bajo 100 KB", () => {
  const filas = Array.from({ length: 50 }, (_, indice) => ({ id: `marca-${indice}`, catequizando_id: ninoId, hora_dispositivo: 1791723600000, tipo_registro: "escaneo", cuenta_id: cuenta.cuentaId }));
  const pull = { changes: { marcas_asistencia: { created: filas, updated: [], deleted: [] } }, timestamp: 1791723600000, huellaAlcance: "prueba" };
  expect(aEnvoltorioEspanol(pull).cambios.marcas_asistencia.creados[0]).toHaveProperty("catequizando_id");
  expect(Buffer.byteLength(JSON.stringify(pull)) * 2).toBeLessThan(100 * 1024);
  expect(esquemaPush.safeParse({ changes: { catequizandos: { created: [], updated: [], deleted: [] } } }).success).toBe(false);
  expect(esquemaPush.safeParse({ changes: {}, administracion: {} }).success).toBe(false);
});
