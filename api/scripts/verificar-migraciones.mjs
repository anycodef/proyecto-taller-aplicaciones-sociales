import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.argv[2] ?? "origin/main";
const errores = [];
const archivos = readdirSync(resolve(raiz, "api/migraciones"));
const versiones = new Set();
for (const nombre of archivos) {
  if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(nombre)) errores.push(`Nombre de migración inválido: ${nombre}`);
  const version = nombre.slice(0, 4);
  if (versiones.has(version)) errores.push(`Versión duplicada: ${version}`);
  versiones.add(version);
}
const originales = execFileSync("git", ["ls-tree", "-r", "--name-only", base, "--", "api/migraciones"], { cwd: raiz, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const cambios = execFileSync("git", ["diff", "--name-status", base, "--", "api/migraciones"], { cwd: raiz, encoding: "utf8" }).trim().split("\n").filter(Boolean);
for (const cambio of cambios) {
  const [estado, ...rutas] = cambio.split("\t");
  if (estado !== "A" && rutas.some(ruta => originales.includes(ruta))) errores.push(`Migración existente modificada/eliminada: ${rutas.join(" → ")}`);
}
if (errores.length) { console.error(errores.join("\n")); process.exitCode = 1; }
else console.info(`Migraciones inmutables frente a ${base}: ${archivos.length} archivos válidos`);
