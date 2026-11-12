import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// fileURLToPath y no URL.pathname: en Windows pathname devuelve "/D:/ruta" y
// esbuild no la resuelve.
const dominioCompartido = fileURLToPath(new URL("../src/lib", import.meta.url));

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/index.js",
  sourcemap: true,
  packages: "external",
  alias: { "@/lib": dominioCompartido },
});
