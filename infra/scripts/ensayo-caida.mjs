#!/usr/bin/env node
// Ensayo controlado de caida (RF-1204, T001-156). Detiene la Function App,
// espera que la sonda de disponibilidad dispare la alerta, reinicia siempre y
// guarda las horas UTC de cada hito. No lee ni imprime secretos (RNF-1202).
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { parseArgs, promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ejecutar = promisify(execFile);
const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
const ahora = () => new Date().toISOString();

async function az(...argumentos) {
  const binario = process.env.AZ_BIN || "az";
  const { stdout } = await ejecutar(binario, [...argumentos, "--only-show-errors", "--output", "json"], { maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim() ? JSON.parse(stdout) : null;
}

async function estadoDisponible(url) {
  try {
    const respuesta = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    const cuerpo = await respuesta.text();
    return respuesta.status === 200 && cuerpo.includes('{"estado":"disponible"}');
  } catch {
    return false;
  }
}

async function esperarHasta(condicion, { intervalo, limite, descripcion }) {
  const fin = Date.now() + limite;
  for (;;) {
    if (await condicion()) return ahora();
    if (Date.now() >= fin) throw new Error(`Tiempo agotado esperando: ${descripcion}`);
    await esperar(intervalo);
  }
}

async function alertasDeRegla({ suscripcion, grupo, reglaId }) {
  const url = `https://management.azure.com/subscriptions/${suscripcion}/providers/Microsoft.AlertsManagement/alerts?api-version=2019-05-05-preview&targetResourceGroup=${encodeURIComponent(grupo)}&timeRange=1h`;
  const respuesta = await az("rest", "--method", "get", "--url", url);
  return (respuesta?.value ?? []).filter((alerta) => alerta.properties?.essentials?.alertRule?.toLowerCase() === reglaId.toLowerCase());
}

export async function ensayarCaida({ grupo, despliegue = "sigecat-prod", intervaloEstado = 15000, intervaloAlerta = 60000, limiteCaida = 600000, limiteAlerta = 1800000, preguntarCorreo }) {
  const evidencia = { fecha: ahora(), grupo, resultado: "incompleto", hitos: {} };
  const hito = (nombre, valor = ahora()) => {
    evidencia.hitos[nombre] = valor;
    console.log(`${valor}  ${nombre}`);
  };

  const salidas = (await az("deployment", "group", "show", "--resource-group", grupo, "--name", despliegue, "--query", "properties.outputs")) ?? {};
  const funciones = salidas.nombreFunciones?.value;
  const urlEstado = salidas.urlEstado?.value;
  if (!funciones || !urlEstado) throw new Error(`El despliegue ${despliegue} no tiene las salidas nombreFunciones y urlEstado.`);
  const suscripcion = (await az("account", "show")).id;
  const reglas = (await az("monitor", "metrics", "alert", "list", "--resource-group", grupo)) ?? [];
  const regla = reglas.find((r) => r.name.endsWith("-caida"));
  if (!regla) throw new Error("No se encontró la alerta de caída (<prefijo>-disponibilidad-<entorno>-caida).");
  if (!regla.enabled) throw new Error("La alerta de caída está deshabilitada: despliega con publicarPoliticas=true.");
  Object.assign(evidencia, { funciones, urlEstado, regla: regla.name });

  if (!(await estadoDisponible(urlEstado))) throw new Error("La API no está disponible antes del ensayo; no se detiene nada.");
  const previas = await alertasDeRegla({ suscripcion, grupo, reglaId: regla.id });
  if (previas.some((a) => a.properties.essentials.monitorCondition === "Fired")) {
    throw new Error("La alerta ya está disparada; espera a que se resuelva antes de ensayar.");
  }

  hito("inicio");
  let detenida = false;
  const reiniciar = async () => {
    if (!detenida) return;
    detenida = false;
    await az("functionapp", "start", "--resource-group", grupo, "--name", funciones);
    hito("functionsReiniciada");
  };
  const alInterrumpir = () => {
    console.error("\nInterrumpido: reiniciando la Function App antes de salir…");
    reiniciar().finally(() => process.exit(130));
  };
  process.once("SIGINT", alInterrumpir);
  process.once("SIGTERM", alInterrumpir);

  try {
    await az("functionapp", "stop", "--resource-group", grupo, "--name", funciones);
    detenida = true;
    hito("functionsDetenida");
    hito("caidaObservada", await esperarHasta(async () => !(await estadoDisponible(urlEstado)), { intervalo: intervaloEstado, limite: limiteCaida, descripcion: "que /estado/ deje de responder 200" }));
    const disparada = async () => (await alertasDeRegla({ suscripcion, grupo, reglaId: regla.id })).find(
      (a) => a.properties.essentials.monitorCondition === "Fired" && Date.parse(a.properties.essentials.startDateTime) >= Date.parse(evidencia.hitos.inicio),
    );
    hito("alertaDisparada", await esperarHasta(async () => Boolean(await disparada()), { intervalo: intervaloAlerta, limite: limiteAlerta, descripcion: "la alerta disparada" }));
    if (preguntarCorreo) evidencia.hitos.correoRecibido = await preguntarCorreo();
  } catch (error) {
    evidencia.error = error.message;
  } finally {
    try {
      await reiniciar();
    } catch (error) {
      evidencia.error = `${evidencia.error ? `${evidencia.error}; ` : ""}NO SE PUDO REINICIAR: ${error.message}`;
    }
    process.removeListener("SIGINT", alInterrumpir);
    process.removeListener("SIGTERM", alInterrumpir);
  }

  if (!evidencia.error) {
    try {
      hito("recuperada", await esperarHasta(() => estadoDisponible(urlEstado), { intervalo: intervaloEstado, limite: limiteCaida, descripcion: "que /estado/ vuelva a 200" }));
      const resuelta = async () => (await alertasDeRegla({ suscripcion, grupo, reglaId: regla.id })).some(
        (a) => a.properties.essentials.monitorCondition === "Resolved" && Date.parse(a.properties.essentials.startDateTime) >= Date.parse(evidencia.hitos.inicio),
      );
      hito("alertaResuelta", await esperarHasta(resuelta, { intervalo: intervaloAlerta, limite: limiteAlerta, descripcion: "la alerta resuelta" }));
      evidencia.resultado = "completo";
    } catch (error) {
      evidencia.error = error.message;
    }
  }
  const segundos = (desde, hasta) => (evidencia.hitos[desde] && evidencia.hitos[hasta] ? Math.round((Date.parse(evidencia.hitos[hasta]) - Date.parse(evidencia.hitos[desde])) / 1000) : null);
  evidencia.duracionesSegundos = {
    detencionHastaAlerta: segundos("functionsDetenida", "alertaDisparada"),
    reinicioHastaRecuperacion: segundos("functionsReiniciada", "recuperada"),
    reinicioHastaResolucion: segundos("functionsReiniciada", "alertaResuelta"),
  };
  return evidencia;
}

async function principal() {
  const { values } = parseArgs({
    options: {
      grupo: { type: "string", default: "rg-sigecat-prod" },
      despliegue: { type: "string", default: "sigecat-prod" },
      evidencia: { type: "string", default: `ensayo-caida-${new Date().toISOString().slice(0, 10)}.json` },
      confirmar: { type: "boolean", default: false },
      "intervalo-estado": { type: "string" },
      "intervalo-alerta": { type: "string" },
    },
  });
  if (!values.confirmar) {
    console.error("Este ensayo DETIENE la API de producción. Ejecútalo solo en la ventana acordada con el equipo.");
    console.error("Repite el comando con --confirmar para continuar.");
    process.exitCode = 2;
    return;
  }
  const preguntarCorreo = process.stdin.isTTY
    ? async () => {
        const consola = createInterface({ input: process.stdin, output: process.stdout });
        const respuesta = await consola.question("Alerta disparada. Hora UTC de llegada del correo (AAAA-MM-DDTHH:MM) o Enter si aún no llega: ");
        consola.close();
        return respuesta.trim() || null;
      }
    : undefined;
  let evidencia;
  try {
    evidencia = await ensayarCaida({
      grupo: values.grupo,
      despliegue: values.despliegue,
      intervaloEstado: values["intervalo-estado"] ? Number(values["intervalo-estado"]) : undefined,
      intervaloAlerta: values["intervalo-alerta"] ? Number(values["intervalo-alerta"]) : undefined,
      preguntarCorreo,
    });
  } catch (error) {
    console.error(`No se ejecutó el ensayo: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(values.evidencia, `${JSON.stringify(evidencia, null, 2)}\n`);
  console.log(`\nResultado: ${evidencia.resultado}. Evidencia en ${values.evidencia}`);
  if (evidencia.error) console.error(`Detalle: ${evidencia.error}`);
  process.exitCode = evidencia.resultado === "completo" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
