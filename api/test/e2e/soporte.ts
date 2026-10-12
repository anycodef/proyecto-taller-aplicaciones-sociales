import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { HttpRequest, InvocationContext, type HttpResponseInit } from "@azure/functions";
import { TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";
import type { PeticionInscripcion } from "@/lib/catequizandos/contratos";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { manejarAcceso, manejadoresSeguridad } from "../../src/modulos/seguridad/http";
import { manejadoresCatequizandos } from "../../src/modulos/catequizandos/http";
import { manejadoresInscripciones } from "../../src/modulos/inscripciones/http";

export type Manejador = (req: HttpRequest, inv: InvocationContext) => Promise<HttpResponseInit>;
export interface Sesion { jwt: string; tokenRenovacion?: string; contexto: ContextoAcceso; dispositivoId: string }
export async function llamar<T>(manejador: Manejador, ruta: string, sesion?: Sesion, cuerpo?: unknown, params: Record<string, string> = {}, metodo = cuerpo === undefined ? "GET" : "POST") {
  const texto = cuerpo === undefined ? undefined : JSON.stringify(cuerpo);
  const req = new HttpRequest({ url: `https://sigecat.example/api/${ruta}`, method: metodo, params, headers: { ...(sesion ? { authorization: `Bearer ${sesion.jwt}` } : {}), ...(texto ? { "content-type": "application/json" } : {}) }, ...(texto ? { body: { string: texto } } : {}) });
  const respuesta = await manejador(req, new InvocationContext({ functionName: "e2e-backend" }));
  const datos = (respuesta.jsonBody ?? (typeof respuesta.body === "string" ? JSON.parse(respuesta.body) : undefined)) as T;
  return { estado: respuesta.status ?? 200, datos, respuesta, bytesEntrada: texto ? Buffer.byteLength(texto) : Buffer.byteLength(req.url), bytesSalida: Buffer.byteLength(JSON.stringify(datos) ?? "") };
}
export async function exigir<T>(manejador: Manejador, ruta: string, sesion?: Sesion, cuerpo?: unknown, params: Record<string, string> = {}, metodo?: string, estado = 200): Promise<T> {
  const resultado = await llamar<T>(manejador, ruta, sesion, cuerpo, params, metodo);
  expect({ estado: resultado.estado, ...(resultado.estado !== estado ? { datos: resultado.datos } : {}) }).toEqual({ estado });
  return resultado.datos;
}
export async function crearEsquema(): Promise<{ administracion: Pool; api: Pool; esquema: string }> {
  if (!process.env.BD_PRUEBAS_URL) throw new Error("Falta BD_PRUEBAS_URL: E2E real no se omite");
  const esquema = `e2e_${randomUUID().replaceAll("-", "")}`;
  const administracion = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 1, options: `-c search_path=${esquema},pg_catalog -c timezone=America/Lima` });
  const tx = await administracion.connect();
  try {
    await tx.query(`CREATE SCHEMA ${esquema}; GRANT USAGE ON SCHEMA ${esquema} TO sigecat_api,sigecat_retencion; SET search_path TO ${esquema},pg_catalog`);
    const carpeta = resolve(__dirname, "../../migraciones");
    const archivos = (await readdir(carpeta)).filter(nombre => /^\d{4}_.*\.sql$/.test(nombre) && !nombre.startsWith("0001_")).sort();
    for (const archivo of archivos) await tx.query((await readFile(resolve(carpeta, archivo), "utf8")).replace(/\bpublic\b/g, esquema));
  } finally { tx.release(); }
  const api = new Pool({ connectionString: process.env.BD_PRUEBAS_URL, max: 3, connectionTimeoutMillis: 2000, options: `-c search_path=${esquema},pg_catalog -c timezone=America/Lima -c role=sigecat_api -c statement_timeout=5000` });
  return { administracion, api, esquema };
}
export async function bootstrap(administracion: Pool): Promise<Sesion> {
  const cuentaId = randomUUID(), credencialId = randomUUID(), dispositivoId = randomUUID(), token = randomBytes(32).toString("base64url");
  await administracion.query("INSERT INTO cuenta(id,identidad_operativa,es_menor) VALUES($1,'Administración E2E',false)", [cuentaId]);
  await administracion.query("INSERT INTO rol_cuenta(cuenta_id,rol) VALUES($1,'administracion')", [cuentaId]);
  await administracion.query("INSERT INTO credencial(id,cuenta_id,tipo,token_hash,estado) VALUES($1,$2,'equipo',$3,'emitida')", [credencialId, cuentaId, createHash("sha256").update(token).digest()]);
  const sesion = await exigir<Omit<Sesion, "dispositivoId">>(manejarAcceso, "acceso/equipo/activar", undefined, { token, dispositivoId });
  return { ...sesion, dispositivoId };
}
export async function altaEquipo(administrador: Sesion, identidadOperativa: string, roles: Rol[], esMenor = false): Promise<Sesion> {
  const cuentaId = randomUUID(), dispositivoId = randomUUID();
  await exigir(manejadoresSeguridad.crearCuenta, "cuentas", administrador, { id: cuentaId, identidadOperativa, roles, esMenor, ...(esMenor ? { identidadReal: { nombres: "Nombre reservado", apellidos: "Menor E2E", fechaNacimiento: "2010-01-01" } } : {}) }, {}, "POST", 201);
  const enlace = await exigir<{ url: string }>(manejadoresSeguridad.emitirEnlace, `cuentas/${cuentaId}/enlaces`, administrador, { tipo: "equipo" }, { id: cuentaId }, "POST", 201);
  const token = new URLSearchParams(new URL(enlace.url).hash.slice(1)).get("t");
  const sesion = await exigir<Omit<Sesion, "dispositivoId">>(manejarAcceso, "acceso/equipo/activar", undefined, { token, dispositivoId });
  return { ...sesion, dispositivoId };
}
export async function grupo(coordinador: Sesion, cicloId: string, nombre: string, catequista?: Sesion) {
  const id = randomUUID();
  await exigir(manejadoresCatequizandos.crearGrupo, "grupos", coordinador, { id, cicloId, nombre, edadMinima: 8, edadMaxima: 13, modalidad: "mixto" }, {}, "POST", 201);
  if (catequista) await exigir(manejadoresCatequizandos.catequistas, `grupos/${id}/catequistas`, coordinador, { asignaciones: [{ id: randomUUID(), cuentaId: catequista.contexto.cuentaId }] }, { id }, "PUT");
  return id;
}
export function datosInscripcion(grupoId: string, indice: string, apoderadoId?: string): PeticionInscripcion {
  const nuevoApoderadoId = apoderadoId ?? randomUUID();
  return { id: randomUUID(), nino: { id: randomUUID(), nombres: `Niña ${indice}`, apellidos: "E2E", fechaNacimiento: "2016-01-01", sexo: "femenino", bautizado: false }, grupoId, asignacionId: randomUUID(), edadFueraRangoConfirmada: false,
    apoderados: [{ id: randomUUID(), relacion: "madre", ...(apoderadoId ? { apoderadoId } : { apoderado: { id: nuevoApoderadoId, nombres: "Apoderada", apellidos: `E2E ${indice}`, tipoContacto: "otro", valorContacto: "Contacto de prueba", cuentaId: randomUUID(), credencialId: randomUUID() } }) }],
    consentimiento: { id: randomUUID(), apoderadoId: nuevoApoderadoId, textoId: "00100000-0000-4000-8000-000000000001", canal: "presencial" }, documentos: TIPOS_DOCUMENTO.map(tipo => ({ id: randomUUID(), tipo })) };
}
export async function inscribir(coordinador: Sesion, datos: PeticionInscripcion) {
  return exigir<{ inscripcionId: string; catequizandoId: string; codigoCarne: string; enlaces: { apoderadoId: string; url: string }[] }>(manejadoresInscripciones.inscribir, "inscripciones", coordinador, datos, {}, "POST", 201);
}
export async function entrarFamilia(url: string): Promise<Sesion> {
  const token = new URLSearchParams(new URL(url).hash.slice(1)).get("t");
  const sesion = await exigir<Omit<Sesion, "dispositivoId">>(manejarAcceso, "acceso/familia/entrar", undefined, { token });
  return { ...sesion, dispositivoId: randomUUID() };
}
