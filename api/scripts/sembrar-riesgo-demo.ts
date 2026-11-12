import { v5 as uuidV5 } from "uuid";
import type { ContextoAcceso, Rol } from "@/lib/seguridad/contexto-acceso";
import { TIPOS_DOCUMENTO } from "@/lib/catequizandos/documentos";
import { idAsistencia, idSesion } from "@/lib/asistencia/sesiones";
import { enTransaccion, type Tx } from "../src/compartido/bd/transaccion";
import { cerrarPool } from "../src/compartido/bd/pool";
import { crearInscripcion } from "../src/modulos/inscripciones/aplicacion/inscribir";
import { sembrarDemo, type ResultadoDemo } from "./sembrar-demo";

const NAMESPACIO = "c14a3f20-1b98-4da8-a075-4f680d5a1000";
const id = (nombre: string) => uuidV5(nombre, NAMESPACIO);

function ultimosDomingos(ahora: Date, cantidad: number): string[] {
  const fecha = new Date(ahora.getTime() - 5 * 3600000);
  fecha.setUTCHours(0, 0, 0, 0);
  const dia = fecha.getUTCDay();
  fecha.setUTCDate(fecha.getUTCDate() - (dia === 0 ? 7 : dia));
  const domingos: string[] = [];
  for (let indice = 0; indice < cantidad; indice++) {
    domingos.push(fecha.toISOString().slice(0, 10));
    fecha.setUTCDate(fecha.getUTCDate() - 7);
  }
  return domingos.reverse();
}

async function asegurarNino3(tx: Tx, cicloId: string, ctx: ContextoAcceso): Promise<void> {
  const existente = await tx.query("SELECT id FROM catequizando WHERE id=$1", [id("nino:3")]);
  if (existente.rowCount) return;
  const texto = await tx.query<{ id: string }>("SELECT id FROM texto_consentimiento WHERE vigente_desde<=now() ORDER BY vigente_desde DESC LIMIT 1");
  if (!texto.rows[0]) throw new Error("Falta texto de consentimiento; ejecuta las migraciones");
  const anio = Number((await tx.query<{ inicio: string }>("SELECT inicio::text FROM ciclo WHERE id=$1", [cicloId])).rows[0].inicio.slice(0, 4));
  const resultado = await crearInscripcion(tx, {
    id: id("inscripcion:3"),
    nino: {
      id: id("nino:3"),
      nombres: "Niño ficticio 3",
      apellidos: "Demostración",
      fechaNacimiento: `${anio - 9}-01-01`,
      sexo: "masculino",
      bautizado: false,
    },
    grupoId: id("grupo"),
    asignacionId: id("grupo:nino:3"),
    edadFueraRangoConfirmada: false,
    apoderados: [{ id: id("vinculo:3"), relacion: "madre", apoderadoId: id("apoderado") }],
    consentimiento: { id: id("consentimiento:3"), apoderadoId: id("apoderado"), textoId: texto.rows[0].id, canal: "presencial" },
    documentos: TIPOS_DOCUMENTO.map((tipo) => ({ id: id(`documento:3:${tipo}`), tipo })),
  }, ctx);
  if (resultado.estado === 409) throw new Error("Conflicto al crear el niño demo 3");
}

/** Con `demoPrevio` no repite la siembra base, que emitiría otro enlace al catequista y dejaría viejo el ya impreso. */
export async function sembrarRiesgoDemo(demoPrevio?: ResultadoDemo): Promise<{ nino: string; faltas: number }[]> {
  if (!demoPrevio) await sembrarDemo();
  return enTransaccion(async (tx) => {
    const ciclo = (await tx.query<{ id: string }>("SELECT id FROM ciclo WHERE estado='abierto'")).rows[0];
    if (!ciclo) throw new Error("Falta ciclo abierto; ejecuta npm run sembrar:demo");
    const grupo = await tx.query("SELECT id FROM grupo WHERE id=$1 AND ciclo_id=$2", [id("grupo"), ciclo.id]);
    if (!grupo.rowCount) throw new Error("Falta grupo demo; ejecuta npm run sembrar:demo");
    const fila = (await tx.query<{ id: string; credencial_id: string }>("SELECT c.id,cr.id credencial_id FROM cuenta c JOIN rol_cuenta r ON r.cuenta_id=c.id AND r.rol='administracion' JOIN credencial cr ON cr.cuenta_id=c.id AND cr.tipo='equipo' AND cr.estado<>'terminada' WHERE c.activa ORDER BY c.creada_en LIMIT 1")).rows[0];
    if (!fila) throw new Error("Falta administración con credencial; ejecuta npm run sembrar:demo");
    const ctx: ContextoAcceso = {
      cuentaId: fila.id,
      credencialId: fila.credencial_id,
      identidadOperativa: "Administración demo",
      rolesPropios: ["administracion", "coordinacion"] as Rol[],
      gruposAsignados: [],
      catequizandosApoderados: [],
      esMenor: false,
    };

    await asegurarNino3(tx, ciclo.id, ctx);

    const domingos = ultimosDomingos(new Date(), 4);
    const casos = [
      { nino: id("nino:1"), faltas: 2 },
      { nino: id("nino:3"), faltas: 3 },
      { nino: id("nino:2"), faltas: 4 },
    ];
    const idsCasos = casos.map((caso) => caso.nino);

    await tx.query(
      "UPDATE inscripcion SET desde=(SELECT inicio::timestamptz FROM ciclo WHERE id=$1) WHERE ciclo_id=$1 AND catequizando_id=ANY($2::uuid[])",
      [ciclo.id, idsCasos],
    );
    await tx.query(
      "UPDATE asignacion_grupo a SET desde=i.desde FROM inscripcion i WHERE a.inscripcion_id=i.id AND i.ciclo_id=$1 AND i.catequizando_id=ANY($2::uuid[])",
      [ciclo.id, idsCasos],
    );

    for (const caso of casos) {
      for (const fecha of domingos.slice(0, caso.faltas)) {
        for (const tipo of ["misa", "catequesis"] as const) {
          const insertada = await tx.query<{ id: string }>(
            "INSERT INTO sesion(id,ciclo_id,fecha,tipo) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
            [idSesion(ciclo.id, fecha, tipo), ciclo.id, fecha, tipo],
          );
          const sesionId = insertada.rows[0]?.id ?? (await tx.query<{ id: string }>(
            "SELECT id FROM sesion WHERE ciclo_id=$1 AND fecha=$2 AND tipo=$3 AND actividad_id IS NULL",
            [ciclo.id, fecha, tipo],
          )).rows[0]?.id;
          if (!sesionId) throw new Error(`No se pudo crear la sesión ${fecha} ${tipo}`);
          await tx.query(
            `INSERT INTO asistencia(id,ciclo_id,sesion_id,catequizando_id,valor,tipo_registro,hora_primer_registro,recibido_primer_registro,corregida,conflicto)
             VALUES($1,$2,$3,$4,'ausente','manual',($5::date + time '10:00') AT TIME ZONE 'America/Lima',clock_timestamp(),false,false)
             ON CONFLICT(sesion_id,catequizando_id) DO NOTHING`,
            [idAsistencia(sesionId, caso.nino), ciclo.id, sesionId, caso.nino, fecha],
          );
        }
      }
    }

    const conteo = await tx.query<{ catequizando_id: string; faltas: string }>(
      `SELECT a.catequizando_id,count(DISTINCT s.fecha)::text AS faltas
       FROM asistencia a JOIN sesion s ON s.id=a.sesion_id
       WHERE a.ciclo_id=$1 AND a.valor='ausente' AND a.eliminado_en IS NULL AND s.tipo IN ('misa','catequesis')
       GROUP BY a.catequizando_id`,
      [ciclo.id],
    );
    return casos.map((caso) => ({
      nino: caso.nino,
      faltas: Number(conteo.rows.find((fila) => fila.catequizando_id === caso.nino)?.faltas ?? 0),
    }));
  });
}

if (require.main === module) {
  sembrarRiesgoDemo()
    .then((resumen) => console.info(JSON.stringify({ riesgoDemo: resumen }, null, 2)))
    .catch(() => { console.error("No se pudo sembrar el riesgo demo; usar una BD de desarrollo migrada"); process.exitCode = 1; })
    .finally(cerrarPool);
}
