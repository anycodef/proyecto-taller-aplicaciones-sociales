import { ErrorDeValidacion } from "./errores";
import { EstadoAsistencia, ESTADOS_ASISTENCIA, esEstadoAsistencia } from "./EstadoAsistencia";
import { textoNoVacio } from "./SesionCatequesis";

export type RegistroAsistencia = {
  id: string; // generado en el cliente
  sesionId: string;
  catequizandoId: string; // referencia por identidad al contexto Catequizandos
  estado: EstadoAsistencia;
  registradoPor: string; // identidad operativa: seudónimo si es catequista menor
  registradoEn: string; // ISO
};

/** Crea un registro validando sus invariantes. */
export function crearRegistro(datos: {
  id: unknown;
  sesionId: string;
  catequizandoId: unknown;
  estado: unknown;
  registradoPor: string;
  registradoEn: string;
}): RegistroAsistencia {
  const id = textoNoVacio(datos.id, "registro.id");
  const catequizandoId = textoNoVacio(datos.catequizandoId, "registro.catequizandoId");
  if (!esEstadoAsistencia(datos.estado)) {
    throw new ErrorDeValidacion(
      `registro.estado debe ser uno de: ${ESTADOS_ASISTENCIA.join(", ")} (registro ${id})`,
    );
  }
  return {
    id,
    sesionId: datos.sesionId,
    catequizandoId,
    estado: datos.estado,
    registradoPor: datos.registradoPor,
    registradoEn: datos.registradoEn,
  };
}
