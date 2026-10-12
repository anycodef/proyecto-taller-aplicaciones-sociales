import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function archivosEn(carpeta) {
  const archivos = [];
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", "coverage"].includes(entrada.name)) continue;
    const ruta = resolve(carpeta, entrada.name);
    if (entrada.isDirectory()) archivos.push(...await archivosEn(ruta)); else archivos.push(ruta);
  }
  return archivos;
}
const pruebas = [...await archivosEn(resolve(raiz, "src")), ...await archivosEn(resolve(raiz, "api"))].filter(ruta => /(?:test|spec)\.(?:ts|tsx|mjs|js)$/.test(ruta));
const citas = new Set();
for (const archivo of pruebas) {
  const contenido = await readFile(archivo, "utf8");
  for (const nombre of contenido.matchAll(/\b(?:test|it|describe)(?:\.each\([\s\S]*?\))?\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
    for (const id of nombre[1].matchAll(/\b(?:RF|RNF)-\d{3}\b/g)) citas.add(id[0]);
  }
}
const bloquear = process.argv.includes("--bloquear") ? process.argv[process.argv.indexOf("--bloquear") + 1] : undefined;
let faltantes = 0;
for (const entrada of (await readdir(resolve(raiz, "specs"), { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const contenido = await readFile(resolve(raiz, "specs", entrada.name, "spec.md"), "utf8");
  const ids = [...new Set([...contenido.matchAll(/\b(?:RF|RNF)-\d{3}\b/g)].map(m => m[0]))].filter(id => id.slice(-3, -2) === String(Number(entrada.name.slice(0, 3))));
  const ausentes = ids.filter(id => !citas.has(id));
  console.info(`${entrada.name}: ${ids.length - ausentes.length}/${ids.length} requisitos citados${ausentes.length ? `; pendientes ${ausentes.join(", ")}` : ""}`);
  if (bloquear && entrada.name.startsWith(bloquear)) faltantes += ausentes.length;
}
if (faltantes) process.exitCode = 1;
