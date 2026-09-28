import { ErrorDeValidacion } from "./errores";
import { crearRegistro, RegistroAsistencia } from "./RegistroAsistencia";
import { crearSesion, SesionCatequesis, textoNoVacio } from "./SesionCatequesis";

export type DatosRegistroDePase = {
  id: unknown;
  /** Opcional: si viene, debe coincidir con la sesión del pase. */
  sesionId?: unknown;
  catequizandoId: unknown;
  estado: unknown;
  /** Opcional: instante real de la toma (la cola offline lo conoce). Si falta, se usa `ahora`. */
  registradoEn?: unknown;
};

export type DatosPaseDeLista = {
  sesion: Parameters<typeof crearSesion>[0];
  registros: DatosRegistroDePase[];
  registradoPor: unknown;
};

/**
 * Agregado "pase de lista": una sesión con todos sus registros.
 *
 * Idempotencia (SPEC §3): sesión y registros llevan el id generado en el cliente.
 * Reenviar el mismo lote produce exactamente las mismas entidades, con los mismos ids,
 * y los repositorios las guardan como upsert por id: nada se duplica.
 *
 * Invariantes que se validan aquí, nunca en el controlador:
 * - la sesión es válida (fecha real, tipo misa | catequesis);
 * - hay al menos un registro y cada uno tiene un estado válido;
 * - un mismo id repetido dentro del lote es un solo registro (gana el último);
 * - un catequizando aparece una sola vez por sesión (si no, su falta se contaría doble).
 */
export class PaseDeLista {
  private constructor(
    readonly sesion: SesionCatequesis,
    readonly registros: readonly RegistroAsistencia[],
  ) {}

  static crear(datos: DatosPaseDeLista, ahora: Date): PaseDeLista {
    const sesion = crearSesion(datos.sesion);
    const registradoPor = textoNoVacio(datos.registradoPor, "registradoPor");

    if (!Array.isArray(datos.registros) || datos.registros.length === 0) {
      throw new ErrorDeValidacion("registros debe incluir al menos un registro");
    }

    const porId = new Map<string, RegistroAsistencia>();
    for (const dato of datos.registros) {
      if (dato.sesionId !== undefined && dato.sesionId !== sesion.id) {
        throw new ErrorDeValidacion(
          `registro ${String(dato.id)} pertenece a otra sesión (${String(dato.sesionId)}), no a ${sesion.id}`,
        );
      }
      const registro = crearRegistro({
        id: dato.id,
        sesionId: sesion.id,
        catequizandoId: dato.catequizandoId,
        estado: dato.estado,
        registradoPor,
        registradoEn: instanteIso(dato.registradoEn, ahora),
      });
      porId.set(registro.id, registro);
    }

    const catequizandos = new Set<string>();
    for (const registro of porId.values()) {
      if (catequizandos.has(registro.catequizandoId)) {
        throw new ErrorDeValidacion(
          `el catequizando ${registro.catequizandoId} tiene más de un registro en la sesión ${sesion.id}`,
        );
      }
      catequizandos.add(registro.catequizandoId);
    }

    return new PaseDeLista(sesion, [...porId.values()]);
  }
}

function instanteIso(valor: unknown, ahora: Date): string {
  if (valor === undefined) return ahora.toISOString();
  if (typeof valor !== "string" || Number.isNaN(Date.parse(valor))) {
    throw new ErrorDeValidacion("registro.registradoEn debe ser un instante ISO 8601");
  }
  return new Date(valor).toISOString();
}
