// Comprueba que cada ruta `services/...` o `web/...` citada en sustentacion.md
// exista en el repo. Uso, desde la raíz del repo de la Tarea 2:
//
//   node docs/verificar-referencias.mjs
//
// Las rutas con comodín (services/*/src/...) se validan para ambos servicios.
// Sale con código 1 si falta alguna, o si queda algún marcador ⏳ sin resolver.

import { existsSync, readFileSync } from "node:fs";

const texto = readFileSync(new URL("./sustentacion.md", import.meta.url), "utf8");
const servicios = ["catequizandos", "asistencia"];

const rutas = new Set();
for (const [, ruta] of texto.matchAll(/`((?:services|web)\/[^`\s]+)`/g)) {
  if (ruta.includes("*")) {
    for (const s of servicios) rutas.add(ruta.replace("*", s));
  } else {
    rutas.add(ruta);
  }
}

let faltan = 0;
for (const ruta of [...rutas].sort()) {
  const ok = existsSync(new URL(`../${ruta}`, import.meta.url));
  if (!ok) faltan += 1;
  console.log(`${ok ? "OK      " : "FALTA   "}${ruta}`);
}

const pendientes = (texto.match(/⏳/g) ?? []).length;
console.log(`\n${rutas.size} rutas, ${faltan} inexistentes, ${pendientes} marcadores ⏳ sin resolver.`);
process.exit(faltan > 0 || pendientes > 0 ? 1 : 0);
