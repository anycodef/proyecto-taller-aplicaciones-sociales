import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";

const carpeta = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const puerto = process.env.PUERTO_HOST_PRUEBA ?? "7079";
const hijo = spawn(process.env.FUNC_BIN ?? "func", ["start", "--port", puerto], {
  cwd: carpeta, detached: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, FUNCTIONS_WORKER_RUNTIME: "node", AzureWebJobsStorage: "UseDevelopmentStorage=true", BLOBS_CONEXION: "UseDevelopmentStorage=true", JWT_CLAVE: randomBytes(32).toString("hex"), RENOVACION_CLAVE: randomBytes(32).toString("hex"), URL_WEB: "https://sigecat.example" },
});
let salida = "";
let errorInicio;
hijo.on("error", error => { errorInicio = error; });
for (const flujo of [hijo.stdout, hijo.stderr]) flujo.on("data", datos => { salida = (salida + datos.toString()).slice(-20000); });
try {
  let disponible = false;
  for (let intento = 0; intento < 120; intento++) {
    if (errorInicio) throw new Error("No se encuentra Azure Functions Core Tools; configurar FUNC_BIN");
    if (hijo.exitCode !== null) throw new Error("El host terminó antes de registrar las rutas");
    try {
      const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/yo`, { signal: AbortSignal.timeout(1000) });
      if (respuesta.status === 401 && (await respuesta.json()).codigo === "acceso_denegado") { disponible = true; break; }
    } catch { /* El host descarga el bundle de extensiones en su primer arranque. */ }
    await new Promise(resolver => setTimeout(resolver, 1000));
  }
  if (!disponible) throw new Error("El host no llegó a responder 401 en /api/yo");
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/acceso/equipo/activar`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "A".repeat(43), dispositivoId: randomUUID() }), signal: AbortSignal.timeout(10000),
  });
  if (respuesta.status !== 401 || (await respuesta.json()).codigo !== "acceso_denegado") throw new Error("El canje de enlace inválido no respondió 401 genérico");
  console.info("Host Functions v4 real: rutas cargadas; GET /yo y activación inválida responden 401 genérico");
} catch (error) {
  console.error(error.message);
  console.error(salida);
  process.exitCode = 1;
} finally {
  if (hijo.pid) {
    try { process.kill(-hijo.pid, "SIGTERM"); } catch { /* Ya había terminado. */ }
    await new Promise(resolver => setTimeout(resolver, 500));
    try { process.kill(-hijo.pid, "SIGKILL"); } catch { /* No dejar procesos del host en segundo plano. */ }
  }
}
