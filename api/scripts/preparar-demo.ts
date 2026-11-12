import { cerrarPool } from "../src/compartido/bd/pool";
import { guardarDemoLocal, sembrarDemo } from "./sembrar-demo";
import { sembrarJustificacionesDemo } from "./sembrar-justificaciones-demo";

/**
 * Deja la demo lista con una sola orden: siembra 003 (catequista y Grupo demo), 007 (3 niños en riesgo) y
 * 004 (ausencias justificables de la familia) y emite los tres enlaces. Cada ejecución emite enlaces nuevos
 * y deja sin efecto los anteriores. La migración la hace `npm run preparar-demo` antes de este script.
 */
async function preparar(): Promise<void> {
  const base = await sembrarDemo();
  guardarDemoLocal(base);
  const justificaciones = await sembrarJustificacionesDemo(base);
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
