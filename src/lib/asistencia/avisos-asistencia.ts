import type { TipoSesion } from "./tipos";
import { textoMotivo } from "./estado-lista";

/** Aviso de asistencia tal como lo devuelve GET /asistencia/avisos. */
export type AvisoAsistencia = {
  id: string;
  tipo: string;
  sesionId: string;
  catequizandoId: string | null;
  marcaId: string | null;
  detalle: unknown;
  estado: "abierto" | "atendido" | string;
  atendidoEn: string | null;
  atendidoPor: string | null;
};

export type TonoAvisoAsistencia = "advertencia" | "error";

const ETIQUETAS: Record<string, { etiqueta: string; tono: TonoAvisoAsistencia; orden: number }> = {
  revision_cruzada: { etiqueta: "Revisión cruzada", tono: "advertencia", orden: 1 },
  conflicto_registro: { etiqueta: "Conflicto", tono: "advertencia", orden: 2 },
  rechazo_registro: { etiqueta: "Código inválido", tono: "error", orden: 3 },
  colision_id: { etiqueta: "Registro duplicado", tono: "error", orden: 4 },
  rechazo_sesion: { etiqueta: "Cambio de sesión rechazado", tono: "error", orden: 5 },
  rechazo_actividad: { etiqueta: "Actividad rechazada", tono: "error", orden: 6 },
};

export function etiquetaAviso(tipo: string): { etiqueta: string; tono: TonoAvisoAsistencia } {
  const conocida = ETIQUETAS[tipo];
  return conocida ? { etiqueta: conocida.etiqueta, tono: conocida.tono } : { etiqueta: "Aviso", tono: "advertencia" };
}

function motivoDe(detalle: unknown): string | null {
  if (detalle && typeof detalle === "object" && "motivo" in detalle) {
    const motivo = (detalle as { motivo: unknown }).motivo;
    return typeof motivo === "string" ? motivo : null;
  }
  return null;
}

/**
 * Texto del aviso para la coordinación. El nombre del niño sale de la nómina
 * local por su id: el servidor no lo manda en el aviso (RNF-306).
 */
export function textoAviso(aviso: AvisoAsistencia, nombre: string | null): string {
  const quien = nombre ?? "Un niño";
  switch (aviso.tipo) {
    case "revision_cruzada":
      return `${quien} estuvo en misa y no está en la lista de catequesis. Confirma que no usó el carné otra persona.`;
    case "conflicto_registro":
      return `${quien} figura presente y ausente. Quedó como presente.`;
    case "rechazo_registro": {
      const motivo = motivoDe(aviso.detalle);
      return motivo === "carne_invalido" || motivo === "codigo_no_permitido"
        ? "Se leyó un carné no válido. No cuenta como asistencia."
        : `Un registro no se aceptó: ${textoMotivo(motivo ?? "")}`;
    }
    case "colision_id":
      return "Llegó otra versión de un registro ya guardado. Se conservó el primero.";
    case "rechazo_sesion":
      return "Un cambio de domingo no se aceptó. Revisa el motivo y vuelve a intentarlo.";
    default:
      return "Revisa este registro de asistencia.";
  }
}

/** Primero lo que pide acción humana; dentro de cada tipo, en el orden del servidor. */
export function ordenarAvisos(avisos: AvisoAsistencia[]): AvisoAsistencia[] {
  const orden = (tipo: string) => ETIQUETAS[tipo]?.orden ?? 99;
  return avisos
    .map((aviso, indice) => ({ aviso, indice }))
    .sort((a, b) => orden(a.aviso.tipo) - orden(b.aviso.tipo) || a.indice - b.indice)
    .map(({ aviso }) => aviso);
}

/** Domingo del ciclo con sus dos sesiones, tal como lo ve la coordinación. */
export type DomingoDelCiclo = {
  fecha: string;
  misa: { id: string; cancelada: boolean } | null;
  catequesis: { id: string; cancelada: boolean } | null;
};

export function domingosDeSesiones(
  sesiones: { id: string; fecha: string; tipo: TipoSesion; cancelada: boolean }[]
): DomingoDelCiclo[] {
  const porFecha = new Map<string, DomingoDelCiclo>();
  for (const sesion of sesiones) {
    if (sesion.tipo === "actividad") continue;
    const domingo = porFecha.get(sesion.fecha) ?? { fecha: sesion.fecha, misa: null, catequesis: null };
    domingo[sesion.tipo] = { id: sesion.id, cancelada: sesion.cancelada };
    porFecha.set(sesion.fecha, domingo);
  }
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
