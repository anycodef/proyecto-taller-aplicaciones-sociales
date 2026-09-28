// node --test infra/gateway   (usa un servicio simulado, no los reales)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.GATEWAY_KEY = "k";
process.env.RATE_LIMIT = "5";
process.env.ALLOWED_ORIGIN = "http://localhost:5500";

const stub = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ path: req.url, gotKey: "ocp-apim-subscription-key" in req.headers }));
});
let gateway;
let base;

before(async () => {
  await new Promise((r) => stub.listen(0, r));
  const u = `http://localhost:${stub.address().port}`;
  process.env.CAT_UPSTREAM = u;
  process.env.ASIS_UPSTREAM = u;
  const { createServer } = require("./gateway");
  gateway = createServer();
  await new Promise((r) => gateway.listen(0, r));
  base = `http://localhost:${gateway.address().port}`;
});
after(() => {
  gateway.close();
  stub.close();
});

const call = (path, headers = {}, method = "GET") => fetch(base + path, { method, headers });

test("con clave enruta, quita el prefijo y no reenvía la clave", async () => {
  const res = await call("/cat/grupos?x=1", { "Ocp-Apim-Subscription-Key": "k" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { path: "/grupos?x=1", gotKey: false });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5500");
});

test("sin clave -> 401, clave errónea -> 401", async () => {
  assert.equal((await call("/asis/health")).status, 401);
  assert.equal((await call("/asis/health", { "Ocp-Apim-Subscription-Key": "x" })).status, 401);
});

test("ruta desconocida -> 404", async () => {
  assert.equal((await call("/otra", { "Ocp-Apim-Subscription-Key": "k" })).status, 404);
});

test("preflight OPTIONS pasa sin clave", async () => {
  const res = await call("/cat/grupos", {}, "OPTIONS");
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
});

test("supera el límite -> 429 con Retry-After (401 no consume cupo)", async () => {
  const h = { "Ocp-Apim-Subscription-Key": "k" };
  // ya se gastó 1 llamada con clave válida en el primer test
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await call("/cat/grupos", h)).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 429, 429]);
  const limited = await call("/cat/grupos", h);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal((await call("/cat/grupos")).status, 401);
});

test("401 y 429 llevan CORS para que el navegador pueda leerlos; preflight permite la clave", async () => {
  const origin = { Origin: "http://localhost:5500" };
  const unauthorized = await call("/cat/grupos", origin);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("access-control-allow-origin"), "http://localhost:5500");
  const limited = await call("/cat/grupos", { ...origin, "Ocp-Apim-Subscription-Key": "k" });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("access-control-allow-origin"), "http://localhost:5500");
  const preflight = await call("/cat/grupos", origin, "OPTIONS");
  assert.match(preflight.headers.get("access-control-allow-headers"), /Ocp-Apim-Subscription-Key/i);
});
