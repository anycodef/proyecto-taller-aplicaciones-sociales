import { autorizar } from "@/lib/seguridad/autorizacion";
import { MATRIZ_PERMISOS } from "@/lib/seguridad/matriz-permisos";
import { rolesEfectivos, ROLES, type ContextoAcceso, type Rol } from "@/lib/seguridad/contexto-acceso";
import { registrarIntento, validarFormatoPin, verificadorPin } from "@/lib/seguridad/pin";
import { estadoSesionLocal } from "@/lib/seguridad/sesion-local";
import { construirUrlEnlace, extraerTokenDeUrl } from "@/lib/seguridad/enlaces";
import { validarNuevaDelegacion, delegacionVigente } from "@/lib/seguridad/delegacion";
import { validarAlta, nombreVisible } from "@/lib/seguridad/seudonimo";
import { fechaVencimientoRetencion } from "@/lib/seguridad/retencion";
import { alReconectar } from "@/lib/seguridad/reconexion";
import { planCierreSesion } from "@/lib/seguridad/cierre-sesion";
import { inscripcionTieneConsentimiento, textoCumpleRequisitos } from "@/lib/seguridad/consentimiento";
import { avisosVisibles, validarAviso } from "@/lib/avisos/avisos";
const contexto = (...roles: Rol[]): ContextoAcceso => ({ cuentaId: "cuenta", credencialId: "credencial", identidadOperativa: "Luz 3", rolesPropios: roles, gruposAsignados: ["a", "b"], catequizandosApoderados: ["hijo"], esMenor: true });
test("RF-102: varios roles unen grupos e hijos y deniegan un tercero", () => {
  const ctx = contexto("catequista", "familia");
  expect(autorizar(ctx, "perfil:leer", { grupoId: "a" }).permitido).toBe(true);
  expect(autorizar(ctx, "perfil:leer", { grupoId: "b" }).permitido).toBe(true);
  expect(autorizar(ctx, "perfil:leer", { grupoId: "otro", catequizandoId: "hijo" }).permitido).toBe(true);
  expect(autorizar(ctx, "perfil:leer", { grupoId: "otro", catequizandoId: "ajeno" }).permitido).toBe(false);
});
test("RF-102: supervisión sola no escribe; la unión conserva escrituras de otro rol", () => {
  for (const [accion, permiso] of Object.entries(MATRIZ_PERMISOS)) if (permiso.escritura) expect(autorizar(contexto("supervision"), accion).permitido).toBe(false);
  expect(autorizar(contexto("supervision", "coordinacion"), "inscripcion:gestionar").permitido).toBe(true);
  expect(ROLES).toHaveLength(5);
  expect(autorizar(contexto("administracion"), "__proto__").permitido).toBe(false);
});
test("RF-102: escaneo/lista global exige CAT; manual requiere grupo propio", () => {
  expect(autorizar(contexto("catequista"), "asistencia:escanear", { grupoId: "ajeno" }).permitido).toBe(true);
  expect(autorizar(contexto("catequista"), "asistencia:pasar-lista", { grupoId: "ajeno" }).permitido).toBe(true);
  expect(autorizar(contexto("catequista"), "asistencia:manual", { grupoId: "ajeno" }).permitido).toBe(false);
  expect(autorizar(contexto("coordinacion"), "asistencia:escanear").permitido).toBe(false);
});
test("RF-107: administración no accede a salud por sí sola; SUP evidencia, no perfil restringido", () => {
  expect(autorizar(contexto("administracion"), "restringido:leer").permitido).toBe(false);
  expect(autorizar(contexto("administracion", "coordinacion"), "restringido:leer").permitido).toBe(true);
  expect(autorizar(contexto("supervision"), "evidencia:leer").permitido).toBe(true);
  expect(autorizar(contexto("supervision"), "restringido:leer").permitido).toBe(false);
  expect(autorizar(contexto("familia"), "restringido:leer", { catequizandoId: "hijo" }).permitido).toBe(false);
});
test("RF-104: delegado menor tiene COORD sin redelegación ni identidad real", () => {
  const ctx = { ...contexto("catequista"), delegacionVigente: { id: "d", hasta: "2027-01-01T00:00:00Z" } };
  expect(rolesEfectivos(ctx)).toContain("coordinacion");
  expect(autorizar(ctx, "restringido:escribir", { grupoId: "ajeno" }).permitido).toBe(true);
  expect(autorizar(ctx, "delegacion:gestionar").permitido).toBe(false);
  expect(autorizar(ctx, "identidad-real:leer").permitido).toBe(false);
  expect(validarNuevaDelegacion({ delegadoId: "otro", desde: "2026-01-01", hasta: "2026-02-01" }, ctx)).toBe(false);
  expect(delegacionVigente([{ id: "d", delegadoId: "a", deleganteId: "b", desde: "2026-01-01T00:00:00Z", hasta: "2026-02-01T00:00:00Z" }], new Date("2026-02-01T00:00:00Z"))).toBeUndefined();
});
test("RF-105: nombre visible nunca usa identidad real y el menor requiere seudónimo distinto", () => {
  expect(nombreVisible({ identidadOperativa: "Luz 3" })).toBe("Luz 3");
  expect(validarAlta({ esMenor: true, identidadOperativa: "Ana Perez", identidadReal: { nombres: "Ana", apellidos: "Perez" } })).toBe(false);
});
test("RF-103: avisos por grupos, retiro y límite de longitud", () => {
  expect(avisosVisibles([{ grupoId: "a" }, { grupoId: "ajeno" }, { grupoId: "a", retiradoEn: "2026" }], contexto("catequista"))).toHaveLength(1);
  expect(validarAviso(" ")).toBe(false);
  expect(validarAviso("a".repeat(500))).toBe(true);
  expect(validarAviso("a".repeat(501))).toBe(false);
});
test("RF-110 RF-111 RNF-103: token solo en fragmento y enlace HTTPS", () => {
  const url = construirUrlEnlace("https://ejemplo.test/", "familia", "secreto");
  expect(new URL(url).search).toBe("");
  expect(extraerTokenDeUrl(url)).toBe("secreto");
  expect(() => construirUrlEnlace("http://ejemplo.test/", "equipo", "secreto")).toThrow();
});
test("RF-111: cinco fallos son irrevocables y un acierto anterior reinicia", async () => {
  expect(["123", "1234567", "12ab", "1234\n"].some(validarFormatoPin)).toBe(false);
  expect(validarFormatoPin("0123")).toBe(true);
  let estado = { intentosFallidos: 0, bloqueada: false };
  for (let i = 0; i < 5; i++) estado = registrarIntento(estado, false);
  expect(registrarIntento(estado, true).bloqueada).toBe(true);
  expect(registrarIntento({ intentosFallidos: 4, bloqueada: false }, true).intentosFallidos).toBe(0);
  expect(await verificadorPin("1234", "sal", async s => s)).toBe("sal:1234");
});
test("RF-112: vencimiento exacto y reloj atrasado no extiende sesión", () => {
  const base = { ultimaRenovacion: 0, instanteMaximoVisto: 0, intentosFallidos: 0, bloqueada: false };
  expect(estadoSesionLocal({ ...base, ahoraDispositivo: 14 * 86400000 - 1 })).toBe("operativa");
  expect(estadoSesionLocal({ ...base, ahoraDispositivo: 14 * 86400000 })).toBe("requiere-conexion");
  expect(estadoSesionLocal({ ...base, ahoraDispositivo: 0, instanteMaximoVisto: 15 * 86400000 })).toBe("requiere-conexion");
});
test("RF-112: renovación antes de enviar y descarte solo ante credencial terminada", async () => {
  const orden: string[] = [];
  const puertos = { contarPendientes: async () => 3, renovar: async () => { orden.push("renovar"); return "ok" as const; }, enviarPendientes: async () => { orden.push("enviar"); }, descartarPendientes: async () => { orden.push("descartar"); } };
  await alReconectar(puertos);
  expect(orden).toEqual(["renovar", "enviar"]);
  expect(await alReconectar({ ...puertos, renovar: async () => "credencial_terminada" })).toEqual({ rechazados: 3 });
});
test("RF-106: consentimiento vigente y cláusula de constancia sin vencimiento", () => {
  expect(inscripcionTieneConsentimiento([{ retiradoEn: "2026" }])).toBe(false);
  expect(inscripcionTieneConsentimiento([{ retiradoEn: null }])).toBe(true);
  expect(textoCumpleRequisitos("La constancia sacramental se conserva sin vencimiento")).toBe(true);
});
test("RF-108: dos años calendario conservan la hora y ajustan 29 de febrero", () => {
  expect(fechaVencimientoRetencion("2024-02-29T13:20:00Z").toISOString()).toBe("2026-02-28T13:20:00.000Z");
});
test("RNF-102: cierre purga salvo pendientes de la cuenta y conserva credencial", () => {
  expect(planCierreSesion("a")).toEqual([{ tipo: "purgar-excepto-pendientes", cuentaId: "a" }, { tipo: "borrar-jwt" }, { tipo: "conservar-credencial-protegida", cuentaId: "a" }]);
});
