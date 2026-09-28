import { type Consentimiento, validarConsentimiento } from "./consentimiento";
import { ErrorDeValidacion } from "./errores";
import { calcularEdad } from "./fechas";

export const EDAD_MINIMA = 8;
export const EDAD_MAXIMA = 13;

export type DatosCatequizando = {
  id: string;
  grupoId: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string; // YYYY-MM-DD
  apoderadoIds: string[];
  consentimiento: Consentimiento;
};

export type EntradaInscripcion = Omit<DatosCatequizando, "consentimiento" | "apoderadoIds"> & {
  consentimiento: Partial<Consentimiento> | null | undefined;
  apoderadoIds?: string[];
};

/** Contexto que el dominio necesita pero no puede consultar por sí mismo. */
export type ContextoInscripcion = {
  ahora: Date;
  grupoExiste: boolean;
};

const noVacio = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Agregado Catequizando. Solo se construye por `inscribir`, que hace cumplir los tres invariantes:
 * 1. consentimiento informado completo,
 * 2. edad entre 8 y 13 años a la fecha actual,
 * 3. nombres y apellidos no vacíos y grupo existente.
 * Así es imposible tener un catequizando sin consentimiento.
 */
export class Catequizando {
  private constructor(private readonly datos: DatosCatequizando) {}

  static inscribir(entrada: EntradaInscripcion, contexto: ContextoInscripcion): Catequizando {
    const consentimiento = validarConsentimiento(entrada.consentimiento);

    if (!noVacio(entrada.nombres)) throw new ErrorDeValidacion("nombres es obligatorio");
    if (!noVacio(entrada.apellidos)) throw new ErrorDeValidacion("apellidos es obligatorio");
    if (!noVacio(entrada.grupoId) || !contexto.grupoExiste) {
      throw new ErrorDeValidacion("grupoId no corresponde a un grupo existente");
    }
    if (typeof entrada.fechaNacimiento !== "string") {
      throw new ErrorDeValidacion("fechaNacimiento debe tener el formato YYYY-MM-DD");
    }

    const edad = calcularEdad(entrada.fechaNacimiento, contexto.ahora);
    if (edad < EDAD_MINIMA || edad > EDAD_MAXIMA) {
      throw new ErrorDeValidacion(`La edad debe estar entre ${EDAD_MINIMA} y ${EDAD_MAXIMA} años`);
    }

    return new Catequizando({
      id: entrada.id,
      grupoId: entrada.grupoId,
      nombres: entrada.nombres.trim(),
      apellidos: entrada.apellidos.trim(),
      fechaNacimiento: entrada.fechaNacimiento,
      apoderadoIds: entrada.apoderadoIds ?? [],
      consentimiento,
    });
  }

  get id(): string {
    return this.datos.id;
  }

  get grupoId(): string {
    return this.datos.grupoId;
  }

  edad(ahora: Date): number {
    return calcularEdad(this.datos.fechaNacimiento, ahora);
  }

  /** Forma completa, con `fechaNacimiento` y `consentimiento`. */
  aDetalle(): DatosCatequizando {
    return {
      ...this.datos,
      apoderadoIds: [...this.datos.apoderadoIds],
      consentimiento: { ...this.datos.consentimiento },
    };
  }

  /** Forma mínima para listados: un listado nunca arrastra más datos de los necesarios. */
  aResumen(ahora: Date) {
    return {
      id: this.datos.id,
      grupoId: this.datos.grupoId,
      nombres: this.datos.nombres,
      apellidos: this.datos.apellidos,
      edad: this.edad(ahora),
    };
  }
}
