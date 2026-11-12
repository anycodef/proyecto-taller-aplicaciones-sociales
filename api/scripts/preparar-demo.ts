import { randomUUID } from "node:crypto";
import { v5 as uuidV5 } from "uuid";
import type { ContextoAcceso } from "@/lib/seguridad/contexto-acceso";
import { consultar, cerrarPool } from "../src/compartido/bd/pool";
import { crearDelegacion } from "../src/modulos/seguridad/aplicacion/delegaciones";
import { guardarDemoLocal, sembrarDemo } from "./sembrar-demo";
import { sembrarJustificacionesDemo } from "./sembrar-justificaciones-demo";

/**
 * Deja la demo lista con una sola orden: siembra 003 (catequista y Grupo demo), 007 (3 niños en riesgo) y
 * 004 (ausencias justificables de la familia) y emite los tres enlaces. Cada ejecución emite enlaces nuevos
 * y deja sin efecto los anteriores. La migración la hace `npm run preparar-demo` antes de este script.
 */
const id = (nombre: string) => uuidV5(nombre, "c14a3f20-1b98-4da8-a075-4f680d5a1000");

/**
 * Con un solo celular no se puede mostrar a la vez al catequista y a la coordinación (la coordinación no entra por la web).
 * La delegación de la spec 001 (RF-104) resuelve eso: la coordinación delega en el catequista demo y el mismo celular
 * ve el panel de coordinación durante el periodo. Se activa con DEMO_DELEGACION=1 y se debe abrir un enlace nuevo después.
 */
async function delegarAlCatequista(): Promise<void> {
  const fila = await consultar<{ credencial_id: string }>(
    "SELECT cr.id credencial_id FROM credencial cr WHERE cr.cuenta_id=$1 AND cr.tipo='equipo' AND cr.estado<>'terminada'",
    [id("coord")],
  );
  if (!fila.rows[0]) throw new Error("Falta la credencial de la coordinación demo");
  const ctx: ContextoAcceso = {
    cuentaId: id("coord"), credencialId: fila.rows[0].credencial_id, identidadOperativa: "Coordinación demo",
    rolesPropios: ["coordinacion"], gruposAsignados: [], catequizandosApoderados: [], esMenor: false,
  };
  const desde = new Date(Date.now() - 60_000).toISOString();
  const hasta = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
  await crearDelegacion({ id: randomUUID(), delegadoId: id("cat"), desde, hasta }, ctx);
}

async function preparar(): Promise<void> {
  const base = await sembrarDemo();
  guardarDemoLocal(base);
  const justificaciones = await sembrarJustificacionesDemo(base);
  const delegada = process.env.DEMO_DELEGACION === "1";
  if (delegada) await delegarAlCatequista();
  const enlaces = {
    catequista: base.demo.enlace,
    catequistaExpoGo: base.demo.enlaceExpo,
    coordinacion: justificaciones.enlaceCoordinacion,
    familia: justificaciones.enlaceFamilia,
  };
  console.info("\nDemo lista. Enlaces nuevos (se muestran una sola vez; no los publiques):\n");
  console.info(`  Catequista   ${enlaces.catequista}`);
  if (enlaces.catequistaExpoGo) console.info(`  Catequista (Expo Go)  ${enlaces.catequistaExpoGo}`);
  console.info(`  Coordinación ${enlaces.coordinacion}`);
  console.info(`  Familia      ${enlaces.familia}`);
  if (delegada) console.info("\nDelegación creada: el catequista demo ve también el panel de coordinación (2 días). Abre su enlace de nuevo en el celular.");
  console.info(`\nHijo de la familia: ${justificaciones.hijo}`);
  console.info(`Ausencias justificables: ${justificaciones.ausenciasJustificables.map((a) => `${a.tipoSesion} ${a.fecha}`).join(", ")}`);
  console.info(`Riesgo sembrado (faltas por niño): ${justificaciones.riesgo.map((r) => r.faltas).join(", ")}\n`);
}

preparar()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("No se pudo preparar la demo; revisa que la BD esté migrada y que URL_WEB sea https");
    process.exitCode = 1;
  })
  .finally(cerrarPool);
