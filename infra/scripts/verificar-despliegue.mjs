#!/usr/bin/env node
// Verificacion posterior al despliegue (RF-1203). Nunca imprime la clave de
// suscripcion (RNF-1202): se lee de VERIFICAR_CLAVE_APIM para que no quede en el
// historial de la terminal.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const ORIGEN_AJENO = "https://origen-no-autorizado.example";

function sinBarraFinal(url) {
  return url.replace(/\/+$/, "");
}

async function pedir(url, opciones, tiempo) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(tiempo), ...opciones });
}

function resultado(id, descripcion, ok, detalle) {
  return { id, descripcion, estado: ok ? "PASÓ" : "FALLÓ", detalle };
}

export async function verificarDespliegue({ urlApi, urlWeb, urlEstado, urlHttp, clave, tiempo = 15000 }) {
  const api = sinBarraFinal(urlApi);
  const web = sinBarraFinal(urlWeb);
  const estado = urlEstado ?? `${api.replace(/\/v1$/, "")}/estado/`;
  const http = sinBarraFinal(urlHttp ?? api.replace(/^https:/, "http:"));
  const origenWeb = new URL(web).origin;
  const resultados = [];
  const comprobar = async (id, descripcion, prueba) => {
    try {
      const { ok, detalle } = await prueba();
      resultados.push(resultado(id, descripcion, ok, detalle));
    } catch (error) {
      resultados.push(resultado(id, descripcion, false, `sin respuesta (${error.name})`));
    }
  };

  await comprobar("estado", "Estado técnico 200, no-store y cuerpo mínimo", async () => {
    const respuesta = await pedir(estado, {}, tiempo);
    const cuerpo = await respuesta.text();
    const cache = respuesta.headers.get("cache-control") ?? "";
    const ok = respuesta.status === 200 && cache.includes("no-store") && cuerpo.includes('{"estado":"disponible"}');
    return { ok, detalle: `HTTP ${respuesta.status}; cache-control: ${cache || "ausente"}` };
  });

  await comprobar("sin-credencial", "/v1 sin credencial responde 401", async () => {
    const respuesta = await pedir(`${api}/yo`, {}, tiempo);
    await respuesta.body?.cancel();
    return { ok: respuesta.status === 401, detalle: `HTTP ${respuesta.status}` };
  });

  if (clave) {
    await comprobar("sin-jwt", "/v1 con suscripción pero sin JWT responde 401", async () => {
      const respuesta = await pedir(`${api}/yo`, { headers: { "ocp-apim-subscription-key": clave } }, tiempo);
      await respuesta.body?.cancel();
      return { ok: respuesta.status === 401, detalle: `HTTP ${respuesta.status}` };
    });
  } else {
    resultados.push({ id: "sin-jwt", descripcion: "/v1 con suscripción pero sin JWT responde 401", estado: "OMITIDA", detalle: "define VERIFICAR_CLAVE_APIM para comprobarlo" });
  }

  await comprobar("solo-https", "La API no responde con éxito por HTTP", async () => {
    try {
      const respuesta = await pedir(`${http}/yo`, {}, tiempo);
      await respuesta.body?.cancel();
      return { ok: respuesta.status < 200 || respuesta.status >= 300, detalle: `HTTP ${respuesta.status}` };
    } catch (error) {
      return { ok: true, detalle: `conexión rechazada (${error.name})` };
    }
  });

  const preflight = (origen) =>
    pedir(`${api}/yo`, {
      method: "OPTIONS",
      headers: {
        origin: origen,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,ocp-apim-subscription-key",
      },
    }, tiempo);

  await comprobar("cors-web", "CORS permite el origen de la web", async () => {
    const respuesta = await preflight(origenWeb);
    await respuesta.body?.cancel();
    const permitido = respuesta.headers.get("access-control-allow-origin");
    return { ok: permitido === origenWeb, detalle: `allow-origin: ${permitido ?? "ausente"}` };
  });

  await comprobar("cors-ajeno", "CORS rechaza un origen ajeno", async () => {
    const respuesta = await preflight(ORIGEN_AJENO);
    await respuesta.body?.cancel();
    const permitido = respuesta.headers.get("access-control-allow-origin");
    return { ok: permitido !== ORIGEN_AJENO && permitido !== "*", detalle: `allow-origin: ${permitido ?? "ausente"}` };
  });

  await comprobar("web-cabeceras", "La web responde con HSTS, CSP, nosniff y no-referrer", async () => {
    const respuesta = await pedir(`${web}/`, {}, tiempo);
    await respuesta.body?.cancel();
    const cabecera = (nombre) => respuesta.headers.get(nombre) ?? "";
    const faltan = [
      ["strict-transport-security", cabecera("strict-transport-security").includes("max-age=")],
      ["content-security-policy", cabecera("content-security-policy").includes("default-src")],
      ["x-content-type-options", cabecera("x-content-type-options") === "nosniff"],
      ["referrer-policy", cabecera("referrer-policy") === "no-referrer"],
      ["content-type html", cabecera("content-type").includes("text/html")],
    ].filter(([, ok]) => !ok).map(([nombre]) => nombre);
    return { ok: respuesta.status === 200 && faltan.length === 0, detalle: `HTTP ${respuesta.status}${faltan.length ? `; faltan: ${faltan.join(", ")}` : ""}` };
  });

  await comprobar("web-ruta-interna", "Una ruta interna de la web carga", async () => {
    const respuesta = await pedir(`${web}/acceso/equipo`, {}, tiempo);
    await respuesta.body?.cancel();
    const tipo = respuesta.headers.get("content-type") ?? "";
    return { ok: respuesta.status === 200 && tipo.includes("text/html"), detalle: `HTTP ${respuesta.status}` };
  });

  return resultados;
}

async function principal() {
  const { values } = parseArgs({
    options: {
      api: { type: "string" },
      web: { type: "string" },
      estado: { type: "string" },
      http: { type: "string" },
      evidencia: { type: "string" },
      tiempo: { type: "string" },
    },
  });
  if (!values.api || !values.web) {
    console.error("Uso: node infra/scripts/verificar-despliegue.mjs --api https://<apim>.azure-api.net/v1 --web https://<web>.azurestaticapps.net [--evidencia archivo.json]");
    console.error("Opcional: VERIFICAR_CLAVE_APIM=<clave web-familias> para comprobar el rechazo sin JWT.");
    process.exitCode = 2;
    return;
  }
  const resultados = await verificarDespliegue({
    urlApi: values.api,
    urlWeb: values.web,
    urlEstado: values.estado,
    urlHttp: values.http,
    clave: process.env.VERIFICAR_CLAVE_APIM || undefined,
    tiempo: values.tiempo ? Number(values.tiempo) : undefined,
  });
  for (const r of resultados) console.log(`${r.estado.padEnd(7)} ${r.id.padEnd(17)} ${r.descripcion} — ${r.detalle}`);
  const fallos = resultados.filter((r) => r.estado === "FALLÓ").length;
  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : "\nTodas las comprobaciones ejecutadas pasaron.");
  if (values.evidencia) {
    writeFileSync(values.evidencia, `${JSON.stringify({ fecha: new Date().toISOString(), api: values.api, web: values.web, resultados }, null, 2)}\n`);
  }
  process.exitCode = fallos ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
