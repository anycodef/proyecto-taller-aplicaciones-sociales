import type { AusenciaRef, EstadoVisible } from "./tipos";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «domingo 8 de noviembre»; calcula sobre la fecha civil para no depender de la zona del celular. */
export function etiquetaFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  const civil = new Date(Date.UTC(anio, mes - 1, dia));
  return `${DIAS[civil.getUTCDay()]} ${dia} de ${MESES[mes - 1]}`;
}

const SESIONES: Record<AusenciaRef["tipoSesion"], string> = { misa: "Misa", catequesis: "Catequesis", actividad: "Actividad obligatoria" };

export function etiquetaSesiones(ausencias: readonly Pick<AusenciaRef, "tipoSesion">[]): string {
  const tipos = [...new Set(ausencias.map((a) => a.tipoSesion))];
  const nombres = tipos.map((t, i) => (i === 0 ? SESIONES[t] : SESIONES[t].toLowerCase()));
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres[0] ?? "";
}

export const ETIQUETAS_ESTADO: Record<EstadoVisible, string> = {
  pendiente: "En revisión",
  aprobada: "Aceptada",
  rechazada: "Rechazada",
  sin_efecto: "Sin efecto",
};

export const ETIQUETAS_ORIGEN = { usted: "Enviada por usted", otro_apoderado: "Enviada por otro apoderado", coordinacion: "Registrada por la coordinación" } as const;

export const AVISO_SIN_CONEXION = "Sin conexión. Las justificaciones necesitan señal y nada se guarda en este celular.";

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «dom 8 nov», para tarjetas donde la fecha larga no cabe. */
export function etiquetaFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  const civil = new Date(Date.UTC(anio, mes - 1, dia));
  return `${DIAS_CORTOS[civil.getUTCDay()]} ${dia} ${MESES_CORTOS[mes - 1]}`;
}

/** Nombre de cada sesión por separado, para mostrarlas como etiquetas. */
export function nombresSesiones(ausencias: readonly Pick<AusenciaRef, "tipoSesion">[]): string[] {
  return [...new Set(ausencias.map((a) => a.tipoSesion))].map((t) => SESIONES[t]);
}

/** Días civiles que quedan hasta el último día del plazo, incluido; 0 si vence hoy. */
export function diasRestantes(venceEn: string, hoy: string): number {
  const dia = (f: string) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
  return Math.max(0, Math.round((dia(venceEn) - dia(hoy)) / 86_400_000));
}

export function etiquetaDiasRestantes(dias: number): string {
  if (dias === 0) return "Vence hoy";
  return dias === 1 ? "Queda 1 día" : `Quedan ${dias} días`;
}

/**
 * Agrupa por niño y fecha conservando el orden de llegada: misa y catequesis
 * del mismo domingo se leen como una sola ausencia del niño.
 */
export function agruparPorNinoYFecha<T extends { catequizandoId: string; fecha: string }>(
  items: readonly T[],
  claveExtra: (item: T) => string = () => "",
): T[][] {
  const grupos = new Map<string, T[]>();
  for (const item of items) {
    const clave = `${item.catequizandoId}|${item.fecha.slice(0, 10)}|${claveExtra(item)}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(item);
    else grupos.set(clave, [item]);
  }
  return [...grupos.values()];
}

/** «Ana», «Ana y Luis», «Ana, Luis y Rosa». */
export function unirNombres(nombres: readonly string[]): string {
  const unicos = [...new Set(nombres)];
  return unicos.length > 1 ? `${unicos.slice(0, -1).join(", ")} y ${unicos.at(-1)}` : unicos[0] ?? "";
}
