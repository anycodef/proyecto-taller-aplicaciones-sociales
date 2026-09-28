import { Catequizando } from "../domain/catequizando";
import type { Grupo } from "../domain/grupo";

/** Semilla compartida del SPEC (sección 3): los ids no se cambian, Asistencia y la web dependen de ellos. */
export const CICLO_ID = "ciclo-2026";

export const GRUPOS_SEMILLA: Grupo[] = [
  { id: "grp-8", cicloId: CICLO_ID, nombre: "8 años (mixto)", catequistaIds: [] },
  { id: "grp-9", cicloId: CICLO_ID, nombre: "9 años (mixto)", catequistaIds: [] },
  { id: "grp-10", cicloId: CICLO_ID, nombre: "10 años (mixto)", catequistaIds: [] },
  { id: "grp-11-13-h", cicloId: CICLO_ID, nombre: "11 a 13 años (varones)", catequistaIds: [] },
  { id: "grp-11-13-m", cicloId: CICLO_ID, nombre: "11 a 13 años (mujeres)", catequistaIds: [] },
];

// Nombres ficticios. `edad` es la edad que debe tener el niño a la fecha de la semilla.
const CATEQUIZANDOS_SEMILLA: { id: string; grupoId: string; nombres: string; apellidos: string; edad: number }[] = [
  { id: "cat-001", grupoId: "grp-8", nombres: "Luca", apellidos: "Herrera Quispe", edad: 8 },
  { id: "cat-002", grupoId: "grp-8", nombres: "Valeria", apellidos: "Soto Mamani", edad: 8 },
  { id: "cat-003", grupoId: "grp-8", nombres: "Mateo", apellidos: "Rojas Flores", edad: 8 },
  { id: "cat-004", grupoId: "grp-9", nombres: "Camila", apellidos: "Vargas Huamán", edad: 9 },
  { id: "cat-005", grupoId: "grp-9", nombres: "Diego", apellidos: "Paredes Condori", edad: 9 },
  { id: "cat-006", grupoId: "grp-10", nombres: "Sofía", apellidos: "Ramos Chávez", edad: 10 },
  { id: "cat-007", grupoId: "grp-10", nombres: "Andrés", apellidos: "Castro Ttito", edad: 10 },
  { id: "cat-008", grupoId: "grp-11-13-h", nombres: "Joaquín", apellidos: "Mendoza Apaza", edad: 11 },
  { id: "cat-009", grupoId: "grp-11-13-h", nombres: "Santiago", apellidos: "Salazar Ccori", edad: 12 },
  { id: "cat-010", grupoId: "grp-11-13-h", nombres: "Gabriel", apellidos: "Torres Layme", edad: 13 },
  { id: "cat-011", grupoId: "grp-11-13-m", nombres: "Isabella", apellidos: "Guzmán Yupanqui", edad: 11 },
  { id: "cat-012", grupoId: "grp-11-13-m", nombres: "Renata", apellidos: "Delgado Puma", edad: 13 },
];

const dia = (d: Date): string => d.toISOString().slice(0, 10);

/** Construye los 12 catequizandos por el agregado, así la semilla también cumple los invariantes. */
export function crearCatequizandosSemilla(ahora: Date): Catequizando[] {
  const otorgadoEn = new Date(ahora.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const retencionHasta = dia(new Date(Date.UTC(ahora.getUTCFullYear() + 3, ahora.getUTCMonth(), ahora.getUTCDate())));

  return CATEQUIZANDOS_SEMILLA.map((s) =>
    Catequizando.inscribir(
      {
        id: s.id,
        grupoId: s.grupoId,
        nombres: s.nombres,
        apellidos: s.apellidos,
        // cumplió `edad` años hace ~100 días: sigue con esa edad durante meses, sin depender de la fecha exacta
        fechaNacimiento: dia(new Date(Date.UTC(ahora.getUTCFullYear() - s.edad, ahora.getUTCMonth(), ahora.getUTCDate() - 100))),
        consentimiento: { otorgadoPor: "Apoderado ficticio", otorgadoEn, version: "v1", retencionHasta },
      },
      { ahora, grupoExiste: true },
    ),
  );
}
