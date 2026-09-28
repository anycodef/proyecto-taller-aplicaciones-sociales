// Gateway local del plan B: replica las 4 características del APIM (SPEC sección 4)
// sin dependencias, para poder correr en node:20-slim.
//   1. Enrutamiento:  /cat/*  -> CAT_UPSTREAM,  /asis/* -> ASIS_UPSTREAM
//   2. Clave de suscripción (cabecera Ocp-Apim-Subscription-Key) -> 401 si falta o no coincide
//   3. Rate limit: RATE_LIMIT llamadas por RATE_WINDOW_S segundos por clave -> 429
//   4. CORS para ALLOWED_ORIGIN (el preflight OPTIONS no exige clave, igual que en APIM)
const http = require("node:http");

const config = {
  port: Number(process.env.PORT ?? 8080),
  key: process.env.GATEWAY_KEY ?? "demo-key",
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? "http://localhost:5500",
  rateLimit: Number(process.env.RATE_LIMIT ?? 30),
  rateWindowS: Number(process.env.RATE_WINDOW_S ?? 60),
  routes: {
    "/cat": new URL(process.env.CAT_UPSTREAM ?? "http://localhost:3001"),
    "/asis": new URL(process.env.ASIS_UPSTREAM ?? "http://localhost:3002"),
  },
};

const KEY_HEADER = "ocp-apim-subscription-key";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": config.allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Ocp-Apim-Subscription-Key, Content-Type",
  };
}

function reply(res, status, body, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...corsHeaders(), ...extra });
  res.end(JSON.stringify(body));
}

// Ventana fija por clave, como el rate-limit de APIM.
function createLimiter(calls, windowS, now = () => Date.now()) {
  const windows = new Map();
  return function hit(key) {
    const t = now();
    let w = windows.get(key);
    if (!w || t >= w.resetAt) {
      w = { count: 0, resetAt: t + windowS * 1000 };
      windows.set(key, w);
    }
    w.count += 1;
    return { allowed: w.count <= calls, retryAfterS: Math.ceil((w.resetAt - t) / 1000) };
  };
}

function matchRoute(pathname) {
  for (const [prefix, upstream] of Object.entries(config.routes)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return { upstream, path: pathname.slice(prefix.length) || "/" };
    }
  }
  return null;
}

function createServer() {
  const limiter = createLimiter(config.rateLimit, config.rateWindowS);

  return http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      return res.end();
    }

    const url = new URL(req.url, "http://gateway");
    const route = matchRoute(url.pathname);
    if (!route) {
      return reply(res, 404, { statusCode: 404, message: "Resource not found" });
    }

    const key = req.headers[KEY_HEADER];
    if (key !== config.key) {
      return reply(res, 401, {
        statusCode: 401,
        message: "Access denied due to missing or invalid subscription key.",
      });
    }

    const { allowed, retryAfterS } = limiter(key);
    if (!allowed) {
      return reply(
        res,
        429,
        { statusCode: 429, message: `Rate limit is exceeded. Try again in ${retryAfterS} seconds.` },
        { "Retry-After": String(retryAfterS) },
      );
    }

    // No reenviar la clave ni cabeceras CORS de entrada al servicio.
    const headers = { ...req.headers, host: route.upstream.host };
    delete headers[KEY_HEADER];
    const upstreamReq = http.request(
      {
        hostname: route.upstream.hostname,
        port: route.upstream.port,
        path: route.path + url.search,
        method: req.method,
        headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, { ...upstreamRes.headers, ...corsHeaders() });
        upstreamRes.pipe(res);
      },
    );
    upstreamReq.on("error", () =>
      reply(res, 502, { statusCode: 502, message: "Upstream service unavailable" }),
    );
    req.pipe(upstreamReq);
  });
}

module.exports = { createServer, createLimiter, config };

if (require.main === module) {
  createServer().listen(config.port, () =>
    console.log(`gateway escuchando en :${config.port} (limite ${config.rateLimit}/${config.rateWindowS}s)`),
  );
}
