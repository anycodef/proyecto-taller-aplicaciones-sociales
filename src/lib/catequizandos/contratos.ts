import type { Apoderado, Catequizando, Relacion, TipoDocumento } from "./modelo";
export type DatosNino = Pick<Catequizando, "id" | "nombres" | "apellidos" | "fechaNacimiento" | "sexo" | "bautizado">;
export type DatosVinculo = { id: string; relacion: Relacion; detalleRelacion?: string } & ({ apoderadoId: string; apoderado?: never } | { apoderado: Apoderado & { cuentaId: string; credencialId: string }; apoderadoId?: never });
export type PeticionInscripcion = { id: string; nino: DatosNino; apoderados: DatosVinculo[]; grupoId: string; asignacionId: string; consentimiento?: { id: string; apoderadoId: string; textoId: string; canal: "presencial" }; documentos: { id: string; tipo: TipoDocumento }[]; edadFueraRangoConfirmada: boolean; referenciaDuplicado?: string };
export type RespuestaInscripcion = { inscripcionId: string; catequizandoId: string; codigoCarne: string; enlaces: { apoderadoId: string; url: string }[] };
export type Carne = { catequizandoId: string; nombres: string; apellidos: string; grupoId: string; grupo: string; emision: number; codigoCarne: string };
