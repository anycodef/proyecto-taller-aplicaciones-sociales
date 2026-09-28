import { EstadoAsistencia } from "../domain/EstadoAsistencia";
import { RegistroAsistencia } from "../domain/RegistroAsistencia";
import { RegistroRepositorio } from "../domain/RegistroRepositorio";
import { SesionCatequesis, TipoSesion } from "../domain/SesionCatequesis";
import { SesionRepositorio } from "../domain/SesionRepositorio";

/**
 * Semilla de demo (SPEC §3). Solo referencia ids de Catequizandos: no los verifica.
 * Todas las sesiones son anteriores al 2026-09-28; cada domingo hay misa y catequesis.
 */

const CATEQUIZANDOS_POR_GRUPO: Record<string, string[]> = {
  "grp-8": ["cat-001", "cat-002", "cat-003"],
  "grp-9": ["cat-004", "cat-005"],
  "grp-10": ["cat-006", "cat-007"],
  "grp-11-13-h": ["cat-008", "cat-009", "cat-010"],
  "grp-11-13-m": ["cat-011", "cat-012"],
};

const DOMINGOS = ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"];
const TIPOS: TipoSesion[] = ["misa", "catequesis"];

const TEMAS: Record<string, string> = {
  "2026-09-06": "Somos hijos de Dios",
  "2026-09-13": "El Padrenuestro",
  "2026-09-20": "La Sagrada Familia",
  "2026-09-27": "Los Mandamientos",
};

/** Todo el mundo está `presente` salvo lo listado aquí: clave `catequizandoId|fecha|tipo`. */
const EXCEPCIONES: Record<string, EstadoAsistencia> = {
  // cat-003 → 2 ausencias (una a catequesis, una a misa) → medio
  "cat-003|2026-09-13|catequesis": "ausente",
  "cat-003|2026-09-20|misa": "ausente",
  // cat-007 → 3 ausencias → alto
  "cat-007|2026-09-06|misa": "ausente",
  "cat-007|2026-09-13|catequesis": "ausente",
  "cat-007|2026-09-27|misa": "ausente",
  // cat-005 → 1 ausencia + 2 justificadas: las justificadas no suman → bajo
  "cat-005|2026-09-13|misa": "ausente",
  "cat-005|2026-09-20|catequesis": "justificado",
  "cat-005|2026-09-27|misa": "justificado",
  // cat-002 → 1 tardanza: cuenta como asistencia → bajo
  "cat-002|2026-09-20|misa": "tardanza",
  // Ruido de demo que no altera los cuatro casos anteriores
  "cat-010|2026-09-13|misa": "ausente",
  "cat-009|2026-09-27|misa": "tardanza",
  "cat-011|2026-09-20|catequesis": "justificado",
};

export type DatosSemilla = { sesiones: SesionCatequesis[]; registros: RegistroAsistencia[] };

export function generarSemilla(): DatosSemilla {
  const sesiones: SesionCatequesis[] = [];
  const registros: RegistroAsistencia[] = [];

  for (const [grupoId, catequizandos] of Object.entries(CATEQUIZANDOS_POR_GRUPO)) {
    for (const fecha of DOMINGOS) {
      for (const tipo of TIPOS) {
        const sesion: SesionCatequesis = {
          id: `ses-${grupoId}-${fecha}-${tipo}`,
          grupoId,
          fecha,
          tipo,
          ...(tipo === "catequesis" ? { tema: TEMAS[fecha] } : {}),
        };
        sesiones.push(sesion);

        for (const catequizandoId of catequizandos) {
          registros.push({
            id: `reg-${sesion.id}-${catequizandoId}`,
            sesionId: sesion.id,
            catequizandoId,
            estado: EXCEPCIONES[`${catequizandoId}|${fecha}|${tipo}`] ?? "presente",
            registradoPor: "C1",
            registradoEn: `${fecha}T${tipo === "misa" ? "08:30" : "10:30"}:00.000Z`,
          });
        }
      }
    }
  }
  return { sesiones, registros };
}

export async function sembrar(sesiones: SesionRepositorio, registros: RegistroRepositorio): Promise<DatosSemilla> {
  const semilla = generarSemilla();
  for (const sesion of semilla.sesiones) await sesiones.guardar(sesion);
  await registros.guardarVarios(semilla.registros);
  return semilla;
}
