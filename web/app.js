"use strict";

const { CAT_BASE, ASIS_BASE, API_KEY } = window.CONEXION; // resuelta en conexion.js a partir de config.js

const ORDEN_ESTADOS = ["presente", "tardanza", "ausente", "justificado"];
const REGISTRADO_POR = "C1"; // seudónimo del catequista
const LARGO_MS = 550;
const RAFAGA = 40;

const $ = (id) => document.getElementById(id);
const el = {
  mensaje: $("mensaje"), grupo: $("grupo"), tipo: $("tipo"), fecha: $("fecha"),
  lista: $("lista"), guardar: $("guardar"),
  sinClave: $("sinClave"), rafaga: $("rafaga"), resultadoGateway: $("resultadoGateway"),
};

// Estado de la pantalla. Los ids de sesión y de registro se conservan mientras no cambie
// grupo/fecha/tipo: guardar dos veces el mismo pase hace upsert, no duplica.
const estado = {
  ninos: [],
  estados: new Map(),   // catequizandoId -> estado de asistencia
  riesgos: new Map(),   // catequizandoId -> SenalRiesgo
  ids: new Map(),       // clave de sesión -> { sesionId, registros: Map }
};

function nuevoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // crypto.randomUUID solo existe en contextos seguros (https o localhost)
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function hoy() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function mostrar(texto, clase = "info") {
  el.mensaje.textContent = texto;
  el.mensaje.className = clase;
}

function limpiarMensaje() {
  el.mensaje.textContent = "";
  el.mensaje.className = "";
}

// ---------- Cliente HTTP ----------

class ErrorApi extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

function cabeceras(conClave, conCuerpo) {
  const h = {};
  if (conCuerpo) h["Content-Type"] = "application/json";
  if (conClave && API_KEY) h["Ocp-Apim-Subscription-Key"] = API_KEY;
  return h;
}

function mensajeDeEstado(status, cuerpo) {
  if (status === 401) return "401 No autorizado: falta la clave de suscripción o no es válida (revísala en “Conexión”).";
  if (status === 429) return "429 Demasiadas solicitudes: el gateway permite 30 llamadas por minuto. Espera un momento y vuelve a intentar.";
  if (cuerpo && cuerpo.error && cuerpo.error.message) return `${status} ${cuerpo.error.message}`;
  return `Error ${status} al llamar al servicio.`;
}

async function api(base, ruta, { metodo = "GET", cuerpo } = {}) {
  let resp;
  try {
    resp = await fetch(base + ruta, {
      method: metodo,
      headers: cabeceras(true, cuerpo !== undefined),
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(`No se pudo conectar con ${base}. ¿Está encendido el servicio, o el gateway bloquea el origen (CORS)?`, 0);
  }
  let datos = null;
  try { datos = await resp.json(); } catch { /* respuesta sin cuerpo JSON */ }
  if (!resp.ok) throw new ErrorApi(mensajeDeEstado(resp.status, datos), resp.status);
  return datos;
}

function reportar(err) {
  mostrar(err.message, err.status === 429 ? "aviso" : "error");
}

// ---------- Grupos y lista ----------

async function cargarGrupos() {
  try {
    const grupos = await api(CAT_BASE, "/grupos");
    el.grupo.replaceChildren(new Option("Elige un grupo…", ""));
    for (const g of grupos) el.grupo.append(new Option(g.nombre, g.id));
  } catch (err) {
    el.grupo.replaceChildren(new Option("No se pudieron cargar los grupos", ""));
    reportar(err);
  }
}

async function cargarNinos() {
  const grupoId = el.grupo.value;
  estado.ninos = [];
  estado.estados.clear();
  estado.riesgos.clear();
  el.guardar.disabled = true;
  if (!grupoId) return pintarLista();
  try {
    limpiarMensaje();
    estado.ninos = await api(CAT_BASE, `/catequizandos?grupoId=${encodeURIComponent(grupoId)}`);
    for (const n of estado.ninos) estado.estados.set(n.id, "presente"); // ADR 006: todos presentes por defecto
    el.guardar.disabled = estado.ninos.length === 0;
  } catch (err) {
    reportar(err);
  }
  pintarLista();
}

function rotar(id) {
  const actual = estado.estados.get(id);
  const siguiente = ORDEN_ESTADOS[(ORDEN_ESTADOS.indexOf(actual) + 1) % ORDEN_ESTADOS.length];
  estado.estados.set(id, siguiente);
  pintarLista();
}

function pintarLista() {
  if (estado.ninos.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = el.grupo.value ? "Este grupo no tiene catequizandos." : "Elige un grupo.";
    el.lista.replaceChildren(vacio);
    return;
  }
  el.lista.replaceChildren(...estado.ninos.map(filaNino));
}

function filaNino(n) {
  const li = document.createElement("li");
  li.className = "nino";

  const fila = document.createElement("div");
  fila.className = "fila";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "estado";
  const est = estado.estados.get(n.id);
  btn.dataset.estado = est;

  const nombre = document.createElement("span");
  nombre.textContent = `${n.nombres} ${n.apellidos} `;
  const edad = document.createElement("small");
  edad.textContent = `${n.edad} años`;
  nombre.append(edad);
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = est;
  btn.append(nombre, tag);

  // Toque corto rota el estado; toque largo abre el riesgo (y anula el clic que le sigue).
  let temporizador = null;
  let fueLargo = false;
  const cancelar = () => { clearTimeout(temporizador); temporizador = null; };
  btn.addEventListener("pointerdown", () => {
    fueLargo = false;
    temporizador = setTimeout(() => { fueLargo = true; verRiesgo(n.id); }, LARGO_MS);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) btn.addEventListener(ev, cancelar);
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
  btn.addEventListener("click", () => { if (!fueLargo) rotar(n.id); fueLargo = false; });

  const btnRiesgo = document.createElement("button");
  btnRiesgo.type = "button";
  btnRiesgo.className = "sec";
  btnRiesgo.textContent = "Ver riesgo";
  btnRiesgo.addEventListener("click", () => verRiesgo(n.id));

  fila.append(btn, btnRiesgo);
  li.append(fila);

  const r = estado.riesgos.get(n.id);
  if (r) li.append(tarjetaRiesgo(r));
  return li;
}

// ---------- Riesgo ----------

function tarjetaRiesgo(r) {
  const div = document.createElement("div");
  div.className = `riesgo ${r.nivel}`;
  const t = document.createElement("strong");
  t.textContent = `Riesgo ${r.nivel}`;
  div.append(t);
  if (r.motivos && r.motivos.length) {
    const ul = document.createElement("ul");
    for (const m of r.motivos) {
      const li = document.createElement("li");
      li.textContent = m;
      ul.append(li);
    }
    div.append(ul);
  }
  return div;
}

async function verRiesgo(id) {
  try {
    const r = await api(ASIS_BASE, `/catequizandos/${encodeURIComponent(id)}/riesgo`);
    estado.riesgos.set(id, r);
    limpiarMensaje();
    pintarLista();
  } catch (err) {
    reportar(err);
  }
}

// ---------- Guardar pase de lista ----------

function idsDeSesion() {
  const clave = `${el.grupo.value}|${el.fecha.value}|${el.tipo.value}`;
  if (!estado.ids.has(clave)) estado.ids.set(clave, { sesionId: nuevoId(), registros: new Map() });
  return estado.ids.get(clave);
}

async function guardar() {
  if (!el.fecha.value) return mostrar("Elige la fecha de la sesión.", "error");
  const ids = idsDeSesion();
  const ahora = new Date().toISOString();
  const registros = estado.ninos.map((n) => {
    if (!ids.registros.has(n.id)) ids.registros.set(n.id, nuevoId());
    return {
      id: ids.registros.get(n.id),
      sesionId: ids.sesionId,
      catequizandoId: n.id,
      estado: estado.estados.get(n.id),
      registradoPor: REGISTRADO_POR,
      registradoEn: ahora,
    };
  });
  const cuerpo = {
    sesion: { id: ids.sesionId, grupoId: el.grupo.value, fecha: el.fecha.value, tipo: el.tipo.value },
    registros,
    registradoPor: REGISTRADO_POR,
  };

  el.guardar.disabled = true;
  try {
    const r = await api(ASIS_BASE, "/pases-de-lista", { metodo: "POST", cuerpo });
    mostrar(`Pase de lista guardado: ${r.registrosGuardados} registros.`, "ok");
    // los riesgos visibles pueden haber cambiado
    await Promise.all([...estado.riesgos.keys()].map((id) =>
      api(ASIS_BASE, `/catequizandos/${encodeURIComponent(id)}/riesgo`)
        .then((s) => estado.riesgos.set(id, s))
        .catch(() => {})));
    pintarLista();
  } catch (err) {
    reportar(err);
  } finally {
    el.guardar.disabled = estado.ninos.length === 0;
  }
}

// ---------- Panel "Probar gateway" ----------

function resultadoGateway(...lineas) {
  el.resultadoGateway.replaceChildren(...lineas.map(([clase, texto]) => {
    const p = document.createElement("p");
    p.className = clase;
    p.textContent = texto;
    return p;
  }));
}

async function llamarSinClave() {
  el.sinClave.disabled = true;
  resultadoGateway(["aviso", "Llamando a /grupos sin clave…"]);
  try {
    const resp = await fetch(`${CAT_BASE}/grupos`); // sin cabecera Ocp-Apim-Subscription-Key
    if (resp.status === 401) {
      resultadoGateway(["ok", "401 No autorizado: el gateway rechazó la llamada porque no lleva clave de suscripción."]);
    } else if (resp.ok) {
      resultadoGateway(["aviso", `Respondió ${resp.status}: este backend no exige clave. Es lo esperado en local; contra el APIM debería ser 401.`]);
    } else {
      resultadoGateway(["error", `Respondió ${resp.status}, no 401.`]);
    }
  } catch {
    resultadoGateway(["aviso", "La llamada no pudo leerse: error de red o CORS. Si estás contra el APIM, es probable que el 401 llegue sin cabeceras CORS y el navegador lo oculte; revisa la pestaña Red (F12)."]);
  } finally {
    el.sinClave.disabled = false;
  }
}

async function rafaga() {
  el.rafaga.disabled = true;
  resultadoGateway(["aviso", `Enviando ${RAFAGA} llamadas a /grupos…`]);
  const llamadas = Array.from({ length: RAFAGA }, () =>
    fetch(`${CAT_BASE}/grupos`, { headers: cabeceras(true, false) }).then((r) => r.status));
  const resultados = await Promise.allSettled(llamadas);

  const cuenta = { ok: 0, limitadas: 0, otras: 0, red: 0 };
  for (const r of resultados) {
    if (r.status === "rejected") cuenta.red++;
    else if (r.value === 429) cuenta.limitadas++;
    else if (r.value >= 200 && r.value < 300) cuenta.ok++;
    else cuenta.otras++;
  }

  const resumen = `${RAFAGA} llamadas: ${cuenta.ok} respondieron 200, ${cuenta.limitadas} devolvieron 429`
    + (cuenta.otras ? `, ${cuenta.otras} otro estado` : "")
    + (cuenta.red ? `, ${cuenta.red} sin respuesta legible` : "") + ".";
  const lineas = [[cuenta.limitadas > 0 ? "ok" : "aviso", resumen]];
  if (cuenta.limitadas > 0) {
    lineas.push(["ok", `429 Demasiadas solicitudes: el rate limit del gateway (30 por minuto) actuó sobre ${cuenta.limitadas} llamadas.`]);
  } else if (cuenta.red > 0) {
    lineas.push(["aviso", "Ninguna se leyó como 429, pero hubo fallos de red/CORS: un 429 sin cabeceras CORS también se ve así en el navegador."]);
  } else {
    lineas.push(["aviso", "Ninguna devolvió 429: en local no hay límite; contra el APIM, puede que el contador ya se haya reiniciado."]);
  }
  resultadoGateway(...lineas);
  el.rafaga.disabled = false;
}

// ---------- Arranque ----------

el.fecha.value = hoy();
el.grupo.addEventListener("change", cargarNinos);
el.guardar.addEventListener("click", guardar);
el.sinClave.addEventListener("click", llamarSinClave);
el.rafaga.addEventListener("click", rafaga);
cargarGrupos();
