import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap(nombre => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

test("RNF-403: la app de src/ no importa @azure/storage-blob ni @azure/identity", () => {
  const app = resolve(__dirname, "../../../../src");
  const importadores = archivos(app).filter(ruta => /from\s+["']@azure\/(storage-blob|identity)["']/.test(readFileSync(ruta, "utf8")));
  expect(importadores).toEqual([]);
});

test("RNF-403: las dependencias de Blob de la API tienen versión fija", () => {
  const paquete = JSON.parse(readFileSync(resolve(__dirname, "../../../package.json"), "utf8")) as { dependencies: Record<string, string> };
  for (const nombre of ["@azure/storage-blob", "@azure/identity"]) expect(paquete.dependencies[nombre]).toMatch(/^\d+\.\d+\.\d+$/);
});
