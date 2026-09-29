"use strict";

// Resuelve a qué backend habla la web, sin tocar config.js.
// Prioridad: parámetros de la URL (?cat=&asis=&key=) > ajustes guardados en este navegador > config.js.
// Así la misma web publicada (GitHub Pages) sirve contra local, el gateway del plan B o el APIM,
// y la clave nunca tiene que quedar en el repositorio.
(function () {
  const ALMACEN = "sigecat.conexion";
  const PARAMS = { cat: "CAT_BASE", asis: "ASIS_BASE", key: "API_KEY" };
  const base = window.CONFIG;

  function leerGuardado() {
    try {
      return JSON.parse(localStorage.getItem(ALMACEN)) || {};
    } catch {
      return {};
    }
  }

  function guardar(valores) {
    try {
      localStorage.setItem(ALMACEN, JSON.stringify(valores));
      return true;
    } catch {
      return false;
    }
  }

  function borrar() {
    try { localStorage.removeItem(ALMACEN); } catch { /* sin almacenamiento: nada que borrar */ }
  }

  const sinBarraFinal = (url) => url.trim().replace(/\/+$/, "");

  // Los parámetros de la URL se guardan y se quitan de la barra de direcciones,
  // para que la clave no quede en el historial ni en un enlace copiado después.
  const url = new URL(location.href);
  const desdeUrl = {};
  for (const [param, campo] of Object.entries(PARAMS)) {
    if (url.searchParams.has(param)) {
      desdeUrl[campo] = url.searchParams.get(param);
      url.searchParams.delete(param);
    }
  }
  if (Object.keys(desdeUrl).length) {
    guardar({ ...leerGuardado(), ...desdeUrl });
    history.replaceState(null, "", url);
  }

  const guardado = leerGuardado();
  const activa = {
    CAT_BASE: sinBarraFinal(guardado.CAT_BASE || base.CAT_BASE),
    ASIS_BASE: sinBarraFinal(guardado.ASIS_BASE || base.ASIS_BASE),
    API_KEY: (guardado.API_KEY ?? base.API_KEY).trim(),
  };

  const esLocal = (u) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(u);

  // Una página https no puede llamar a http salvo en localhost (contenido mixto).
  function advertencias() {
    const avisos = [];
    if (location.protocol === "https:") {
      for (const u of [activa.CAT_BASE, activa.ASIS_BASE]) {
        if (u.startsWith("http://") && !esLocal(u)) {
          avisos.push(`${u} usa http: el navegador lo bloquea desde una página https. Usa la URL https del gateway.`);
        }
      }
      if (esLocal(activa.CAT_BASE) || esLocal(activa.ASIS_BASE)) {
        avisos.push("Apunta a localhost desde la web publicada: solo funciona si los servicios corren en este mismo equipo y aceptan este origen (CORS).");
      }
    }
    return avisos;
  }

  function descripcion() {
    if (esLocal(activa.CAT_BASE) && esLocal(activa.ASIS_BASE)) {
      return activa.API_KEY ? "Gateway local" : "Servicios locales, sin gateway";
    }
    try {
      return `Gateway ${new URL(activa.CAT_BASE).host}`;
    } catch {
      return "URL no válida";
    }
  }

  function montarPanel() {
    const $ = (id) => document.getElementById(id);
    const form = $("formConexion");
    if (!form) return;

    $("conexionActiva").textContent = descripcion();
    form.catBase.value = activa.CAT_BASE;
    form.asisBase.value = activa.ASIS_BASE;
    form.apiKey.value = activa.API_KEY;

    const avisos = advertencias();
    const lista = $("avisosConexion");
    lista.replaceChildren(...avisos.map((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      return li;
    }));
    // Si la configuración no puede funcionar, el panel se abre solo.
    if (avisos.length) $("panelConexion").open = true;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = guardar({
        CAT_BASE: form.catBase.value,
        ASIS_BASE: form.asisBase.value,
        API_KEY: form.apiKey.value,
      });
      if (!ok) {
        $("avisosConexion").replaceChildren(Object.assign(document.createElement("li"), {
          textContent: "Este navegador no permite guardar ajustes (modo privado o datos bloqueados). Usa los parámetros ?cat=&asis=&key= en la URL.",
        }));
        return;
      }
      location.reload();
    });
    $("restaurarConexion").addEventListener("click", () => {
      borrar();
      location.reload();
    });
  }

  window.CONEXION = activa;
  document.addEventListener("DOMContentLoaded", montarPanel);
})();
