import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Levanta la app para la demostracion: deja la URL de la API y el token del
 * enlace de demo en las variables que Metro inyecta, y arranca el servidor de
 * desarrollo en la red local.
 *
 * Usa el CLI ya instalado (node_modules/.bin/expo) y no `npx`, porque npx
 * puede traer un CLI mas nuevo que actualiza las dependencias del proyecto.
 */

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const archivoDemo = join(raiz, "api", "demo-local.json");

if (!existsSync(archivoDemo)) {
  console.error(
    "Falta api/demo-local.json. Primero siembra los datos de la demo:\n" +
      "  $env:BD_URL=\"postgresql://sigecat_api:demo-local-api-clave-2026@127.0.0.1:5433/sigecat\"\n" +
      "  $env:URL_WEB=\"https://192.168.1.77:8081\"\n" +
      "  $env:URL_APP_EXPO=\"exp://192.168.1.77:8081/--\"\n" +
      "  npm run sembrar-demo"
  );
  process.exit(1);
}

const demo = JSON.parse(readFileSync(archivoDemo, "utf8"));
const navegador = process.argv.includes("--web");
const modo = navegador ? "--web" : "--lan";
const urlApi =
  process.env.EXPO_PUBLIC_URL_API ??
  (navegador ? "http://127.0.0.1:7071/api" : "http://192.168.1.77:7071/api");

const entorno = {
  ...process.env,
  EXPO_PUBLIC_URL_API: urlApi,
  EXPO_PUBLIC_DEMO_ENLACE: demo.token,
  EXPO_PUBLIC_DEMO_PIN: process.env.EXPO_PUBLIC_DEMO_PIN ?? "1234",
};

console.info("Demo de asistencia lista:");
console.info(`  API para el celular : ${urlApi}`);
console.info(`  Cuenta de demo     : ${demo.identidadOperativa} (${demo.grupo}, ${demo.ninos} ninos)`);
console.info(`  Sesion de hoy      : ${demo.fechaSesion}`);
console.info(`  Modo               : ${navegador ? "navegador" : "celular (Expo Go)"}`);
console.info("  Al abrir la app se activa la cuenta y entra directo a pasar lista.");
console.info("");

const binario = join(
  raiz,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "expo.cmd" : "expo"
);
// En Windows los .cmd necesitan shell para poder lanzarse.
const hijo = spawn(binario, ["start", modo], {
  cwd: raiz,
  env: entorno,
  stdio: "inherit",
  shell: process.platform === "win32",
});
hijo.on("exit", codigo => process.exit(codigo ?? 0));
