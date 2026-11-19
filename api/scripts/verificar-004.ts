/*
 * Recorrido de 004 contra la BD y Azurite locales, sin Core Tools: registra los handlers reales de las Functions en memoria
 * y los invoca con peticiones HTTP reales. Familia: ve ausencias, sube la foto y envía el lote. Coordinación: bandeja,
 * evidencia, aprobar. Comprueba que el conteo de 007 baja de 4 a 3. Vuelve a sembrar la demo: los enlaces anteriores
 * dejan de servir, así que repite `npm run preparar-demo` antes de la exposición.
 * Variables: BD_URL, BLOBS_CONEXION=UseDevelopmentStorage=true, URL_WEB (https), JWT_CLAVE, RENOVACION_CLAVE.
 */
/* eslint-disable */
import { randomUUID } from "node:crypto";
import { cerrarPool } from "../src/compartido/bd/pool";
import { sembrarDemo } from "./sembrar-demo";
import { sembrarJustificacionesDemo } from "./sembrar-justificaciones-demo";

const af = require("@azure/functions");
type Entrada = { metodos: string[]; route: string; handler: (req: unknown, inv: unknown) => Promise<{ status?: number; jsonBody?: any }> };
const rutas: Entrada[] = [];
af.app.http = (_nombre: string, o: { methods: string[]; route: string; handler: Entrada["handler"] }) => { rutas.push({ metodos: o.methods, route: o.route, handler: o.handler }); };
af.app.timer = () => undefined;

type Resp = { status: number; cuerpo: any };
async function llamar(metodo: string, ruta: string, opciones: { token?: string; cuerpo?: unknown; bytes?: Uint8Array; tipo?: string } = {}): Promise<Resp> {
  const [camino] = ruta.split("?");
  for (const r of rutas) {
    if (!r.metodos.includes(metodo)) continue;
    const nombres: string[] = [];
    const patron = new RegExp("^" + r.route.replace(/\{(\w+)\}/g, (_m, n) => { nombres.push(n); return "([^/]+)"; }) + "$");
    const m = camino.match(patron);
    if (!m) continue;
    const params: Record<string, string> = {};
    nombres.forEach((n, i) => { params[n] = m[i + 1]; });
    const headers: Record<string, string> = {};
    if (opciones.token) headers.authorization = `Bearer ${opciones.token}`;
    if (opciones.cuerpo !== undefined) headers["content-type"] = "application/json";
    if (opciones.bytes) headers["content-type"] = opciones.tipo ?? "image/jpeg";
    const req = new af.HttpRequest({
      method: metodo, url: `https://local.test/api/${ruta}`, headers, params,
      ...(opciones.cuerpo !== undefined ? { body: { string: JSON.stringify(opciones.cuerpo) } } : {}),
      ...(opciones.bytes ? { body: { bytes: opciones.bytes } } : {}),
    });
    const r2 = await r.handler(req, { log: () => undefined, error: () => undefined, warn: () => undefined });
    return { status: r2.status ?? 200, cuerpo: r2.jsonBody };
  }
  throw new Error(`sin ruta para ${metodo} ${ruta}`);
}
const tokenDe = (enlace: string) => decodeURIComponent(enlace.split("#t=")[1]);
const ok = (condicion: boolean, texto: string) => { console.info(`${condicion ? "OK  " : "FALLA"} ${texto}`); if (!condicion) process.exitCode = 1; };

async function main() {
  // Se carga después de reemplazar `app.http`, para capturar los handlers reales sin levantar el host.
  require("../src/index");
  const base = await sembrarDemo();
  const demo = await sembrarJustificacionesDemo(base);

  const familia = await llamar("POST", "acceso/familia/entrar", { cuerpo: { token: tokenDe(demo.enlaceFamilia) } });
  ok(familia.status === 200 && !!familia.cuerpo?.jwt, `familia entra con su enlace (${familia.status})`);
  const jwtFamilia = familia.cuerpo.jwt as string;
  const coord = await llamar("POST", "acceso/equipo/activar", { cuerpo: { token: tokenDe(demo.enlaceCoordinacion), dispositivoId: randomUUID() } });
  ok(coord.status === 200 && !!coord.cuerpo?.jwt, `coordinación activa su dispositivo (${coord.status})`);
  const jwtCoord = coord.cuerpo.jwt as string;
  const cat = await llamar("POST", "acceso/equipo/activar", { cuerpo: { token: tokenDe(base.demo.enlace), dispositivoId: randomUUID() } });
  const jwtCat = cat.cuerpo?.jwt as string;

  const riesgoAntes = await llamar("GET", "riesgo", { token: jwtCoord });
  const antes = (riesgoAntes.cuerpo as any[]).find((f) => f.nombre.includes("ficticio 2"));
  console.info(`      riesgo antes: ${antes?.nombre} ${antes?.paso} conteo=${antes?.conteo}`);
  ok(antes?.paso === "alerta_retiro" && antes?.conteo === 4, "el niño 2 está en alerta de retiro con 4 faltas");

  const justificables = await llamar("GET", "familia/ausencias-justificables", { token: jwtFamilia });
  const todas = justificables.cuerpo?.ausencias as any[];
  const ausencias = todas.filter((a) => a.nombre.includes("ficticio 2"));
  console.info("      ausencias de la familia:", JSON.stringify(todas.map((a) => `${a.nombre.slice(0, 15)} ${a.tipoSesion} ${a.fecha}`)));
  ok(justificables.status === 200 && ausencias.length === 2, `la familia ve sus ausencias justificables (${ausencias?.length})`);

  const jpeg = new Uint8Array(2000).map((_, i) => (i < 3 ? [0xff, 0xd8, 0xff][i] : i % 251));
  const reserva = await llamar("POST", "evidencias/reservas", { token: jwtFamilia, cuerpo: { archivos: [{ bytes: jpeg.length, contentType: "image/jpeg" }] } });
  ok(reserva.status === 201, `reserva de evidencia (${reserva.status})`);
  const evidenciaId = reserva.cuerpo.evidenciaId as string;
  const subida = await llamar("PUT", `evidencias/${evidenciaId}/archivos/1`, { token: jwtFamilia, bytes: jpeg });
  ok(subida.status === 200, `subida del JPEG a Azurite (${subida.status} ${JSON.stringify(subida.cuerpo)})`);
  const loteId = randomUUID();
  const lote = await llamar("POST", "justificaciones/lotes", {
    token: jwtFamilia,
    cuerpo: { loteId, causa: "salud_nino", evidenciaId, ausencias: ausencias.map((a) => ({ catequizandoId: a.catequizandoId, sesionId: a.sesionId, justificacionId: randomUUID() })) },
  });
  ok(lote.status === 201 && lote.cuerpo.justificaciones.length === 2, `lote creado con 2 justificaciones (${lote.status} ${lote.status === 201 ? "" : JSON.stringify(lote.cuerpo)})`);
  const repetido = await llamar("POST", "justificaciones/lotes", { token: jwtFamilia, cuerpo: { loteId, causa: "salud_nino", evidenciaId, ausencias: lote.cuerpo.justificaciones.map((j: any) => ({ catequizandoId: j.catequizandoId, sesionId: j.sesionId, justificacionId: j.id })) } });
  ok(repetido.status === 201 && JSON.stringify(repetido.cuerpo) === JSON.stringify(lote.cuerpo), "reenviar el mismo lote es idempotente");

  const mias = await llamar("GET", "familia/justificaciones", { token: jwtFamilia });
  ok(mias.cuerpo.justificaciones.length === 2 && mias.cuerpo.justificaciones.every((j: any) => j.estadoVisible === "pendiente" && !JSON.stringify(j).includes("http")), "la familia ve ambas pendientes, sin URL de evidencia");

  ok((await llamar("GET", "justificaciones/bandeja", { token: jwtCat })).status === 403, "el catequista recibe 403 en la bandeja");
  ok((await llamar("POST", "justificaciones/revisiones", { token: jwtFamilia, cuerpo: { justificacionIds: [lote.cuerpo.justificaciones[0].id], decision: "aprobada" } })).status === 403, "la familia no puede aprobar");

  const bandeja = await llamar("GET", "justificaciones/bandeja", { token: jwtCoord });
  const enBandeja = bandeja.cuerpo.lotes.find((l: any) => l.loteId === loteId);
  ok(bandeja.status === 200 && enBandeja?.justificaciones.length === 2, "la coordinación ve el lote en la bandeja");

  const evidencia = await llamar("GET", `justificaciones/${enBandeja.justificaciones[0].id}/evidencia`, { token: jwtCoord });
  ok(evidencia.status === 200 && !!evidencia.cuerpo?.url, `URL temporal de la evidencia (${evidencia.status})`);
  const foto = await fetch(evidencia.cuerpo.url);
  const bytes = new Uint8Array(await foto.arrayBuffer());
  ok(foto.status === 200 && bytes.length === jpeg.length && bytes[0] === 0xff, `la foto se descarga de Azurite con la URL firmada (${foto.status}, ${bytes.length} bytes)`);

  const rechazoSinMotivo = await llamar("POST", "justificaciones/revisiones", { token: jwtCoord, cuerpo: { justificacionIds: [enBandeja.justificaciones[1].id], decision: "rechazada" } });
  ok(rechazoSinMotivo.status === 422, "rechazar sin motivo responde 422");

  // Se aprueba solo la justificación del domingo para ver bajar el conteo; la otra queda pendiente.
  const aprobada = await llamar("POST", "justificaciones/revisiones", { token: jwtCoord, cuerpo: { justificacionIds: enBandeja.justificaciones.map((j: any) => j.id), decision: "aprobada" } });
  ok(aprobada.status === 200 && aprobada.cuerpo.revisadas.length === 2, `la coordinación aprueba el lote (${aprobada.status})`);

  const riesgoDespues = await llamar("GET", "riesgo", { token: jwtCoord });
  const despues = (riesgoDespues.cuerpo as any[]).find((f) => f.nombre.includes("ficticio 2"));
  console.info(`      riesgo después: ${despues?.nombre} ${despues?.paso} conteo=${despues?.conteo}`);
  ok(despues?.conteo === 3 && despues?.paso !== "alerta_retiro", "tras aprobar, el conteo baja de 4 a 3 y sale de la alerta de retiro");

  const mias2 = await llamar("GET", "familia/justificaciones", { token: jwtFamilia });
  ok(mias2.cuerpo.justificaciones.every((j: any) => j.estadoVisible === "aprobada"), "la familia ve sus justificaciones aprobadas");
  const yaNo = await llamar("GET", "familia/ausencias-justificables", { token: jwtFamilia });
  ok(!yaNo.cuerpo.ausencias.some((a: any) => a.nombre.includes("ficticio 2")), "ya no quedan ausencias del niño 2 por justificar");
}

main().catch((e) => { console.error("ERROR", e); process.exitCode = 1; }).finally(cerrarPool);
