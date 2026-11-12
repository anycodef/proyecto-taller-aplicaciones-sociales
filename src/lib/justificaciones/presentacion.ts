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
