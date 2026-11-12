import { v5 as uuidV5 } from "uuid";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { enTransaccion } from "../src/compartido/bd/transaccion";
import { cerrarPool } from "../src/compartido/bd/pool";
import { emitirEnlace } from "../src/modulos/seguridad/aplicacion/cuentas";
import { sembrarRiesgoDemo } from "./sembrar-riesgo-demo";

const id = (nombre: string) => uuidV5(nombre, "c14a3f20-1b98-4da8-a075-4f680d5a1000");

export type ResultadoJustificacionesDemo = {
  enlaceFamilia: string;
  enlaceCoordinacion: string;
  hijo: string;
  ausenciasJustificables: { fecha: string; tipoSesion: string }[];
  riesgo: { nino: string; faltas: number }[];
};

/**
 * Deja la demo de 004 lista y repetible: el niño con 4 faltas (alerta de retiro) tiene la del último
 * domingo dentro del plazo, sin justificación; aprobarla debe bajarlo a 3 en el riesgo (007).
 * Borrar justificaciones solo es posible en el contexto de retención, igual que la siembra de 003.
 */
export async function sembrarJustificacionesDemo(): Promise<ResultadoJustificacionesDemo> {
  const riesgo = await sembrarRiesgoDemo();
  return enTransaccion(async (tx) => {
    const admin = (await tx.query<{ id: string; credencial_id: string }>(
      "SELECT c.id,cr.id credencial_id FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id AND r.rol='administracion' JOIN credencial cr ON cr.cuenta_id=c.id AND cr.tipo='equipo' AND cr.estado<>'terminada' WHERE c.activa ORDER BY c.creada_en LIMIT 1",
    )).rows[0];
    if (!admin) throw new Error("Falta administración con credencial; ejecuta npm run sembrar:demo");
    const ctx: ContextoAcceso = {
      cuentaId: admin.id, credencialId: admin.credencial_id, identidadOperativa: "Administración demo",
      rolesPropios: ["administracion", "coordinacion"] as Rol[], gruposAsignados: [], catequizandosApoderados: [], esMenor: false,
    };
    const ninoId = id("nino:2");

    await tx.query("SET LOCAL ROLE sigecat_retencion");
    await tx.query("SELECT set_config('sigecat.contexto','retencion',true)");
    await tx.query("DELETE FROM justificacion_evento WHERE justificacion_id IN (SELECT id FROM justificacion WHERE catequizando_id=$1)", [ninoId]);
    await tx.query("DELETE FROM justificacion WHERE catequizando_id=$1", [ninoId]);
    await tx.query("RESET ROLE");

    // Una justificación de otro niño con la misma evidencia no se toca; aquí solo se limpia el niño de la demo.
    const ausencias = await tx.query<{ fecha: string; tipo: string }>(
      `SELECT s.fecha::text AS fecha,s.tipo FROM asistencia a JOIN sesion s ON s.id=a.sesion_id
       WHERE a.catequizando_id=$1 AND a.valor='ausente' AND a.eliminado_en IS NULL AND s.tipo IN ('misa','catequesis')
         AND s.fecha=(SELECT max(s2.fecha) FROM asistencia a2 JOIN sesion s2 ON s2.id=a2.sesion_id WHERE a2.catequizando_id=$1 AND a2.valor='ausente' AND a2.eliminado_en IS NULL)
       ORDER BY s.tipo`,
      [ninoId],
    );
    const enlaceFamilia = (await emitirEnlace(id("familia"), "familia", tx, ctx)).url;
    const enlaceCoordinacion = (await emitirEnlace(id("coord"), "equipo", tx, ctx)).url;
    return {
      enlaceFamilia, enlaceCoordinacion, hijo: "Niño ficticio 2 Demostración",
      ausenciasJustificables: ausencias.rows.map((fila) => ({ fecha: fila.fecha, tipoSesion: fila.tipo })),
      riesgo,
    };
  });
}

if (require.main === module) {
  sembrarJustificacionesDemo()
    .then((resultado) => console.info(JSON.stringify({ justificacionesDemo: resultado }, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      console.error("No se pudo sembrar la demo de justificaciones; usar una BD de desarrollo migrada");
      process.exitCode = 1;
    })
    .finally(cerrarPool);
}
