/** Perfil de un niño tal como lo devuelve `GET /catequizandos/{id}/perfil` (spec 002, RF-201). */
export type DomingoPerfil = { fecha: string; misa: string; catequesis: string };

export type PerfilApi = {
  catequizandoId: string;
  nombres: string;
  apellidos: string;
  edad: number;
  grupo: { id: string; nombre: string } | null;
  fechaNacimiento: string;
  sexo: "femenino" | "masculino";
  bautizado: boolean;
  documentos: { id: string; tipo: string; estado: string; motivo: string | null; fechaEstado: string }[];
  resumenes?: { resumenAsistencia?: { domingos: DomingoPerfil[]; ausencias: number; faltas: number } };
  apoderados: { id: string; nombres: string; apellidos: string; relacion: string; detalleRelacion: string | null }[];
};

export const ETIQUETA_DOCUMENTO: Record<string, string> = {
  documento_identidad: "Documento de identidad",
  partida_nacimiento: "Partida de nacimiento",
  partida_bautismo: "Partida de bautismo",
  boleta_pago: "Boleta de pago",
  ficha_compromiso: "Ficha de compromiso",
};

const ESTADOS_DOCUMENTO: Record<string, { texto: string; tono: "solido" | "advertencia" | "error" | "neutro" }> = {
  entregado: { texto: "Entregado", tono: "solido" },
  pendiente: { texto: "Pendiente", tono: "advertencia" },
  invalido: { texto: "Inválido", tono: "error" },
  no_aplica: { texto: "No aplica", tono: "neutro" },
};

export const estadoDeDocumento = (estado: string) => ESTADOS_DOCUMENTO[estado] ?? { texto: estado, tono: "neutro" as const };

const ESTADOS_ASISTENCIA: Record<string, { texto: string; tono: "solido" | "error" | "neutro" }> = {
  presente: { texto: "Presente", tono: "solido" },
  tardanza: { texto: "Presente", tono: "solido" },
  ausente: { texto: "Ausente", tono: "error" },
  sin_registro: { texto: "Sin registro", tono: "neutro" },
  no_aplica: { texto: "Sin sesión", tono: "neutro" },
};

export const estadoDeAsistencia = (estado: string) => ESTADOS_ASISTENCIA[estado] ?? { texto: estado, tono: "neutro" as const };

/** Los últimos domingos ya ocurridos, del más reciente al más antiguo: lo futuro está «pendiente» y no se muestra. */
export function ultimosDomingos(domingos: readonly DomingoPerfil[], cantidad: number): DomingoPerfil[] {
  return domingos
    .filter((d) => !(d.misa === "pendiente" && d.catequesis === "pendiente") && !(d.misa === "no_aplica" && d.catequesis === "no_aplica"))
    .filter((d) => d.misa !== "pendiente")
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, cantidad);
}

export const RELACION_APODERADO: Record<string, string> = { madre: "Madre", padre: "Padre", tutor: "Tutor", otro: "Otro familiar" };

export const textoRelacion = (relacion: string, detalle: string | null): string => detalle ?? RELACION_APODERADO[relacion] ?? relacion;

export function documentosPendientes(documentos: PerfilApi["documentos"]): number {
  return documentos.filter((d) => d.estado === "pendiente" || d.estado === "invalido").length;
}
