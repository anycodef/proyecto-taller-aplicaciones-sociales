import { ErrorDeValidacion } from "../../domain/errores";
import { DatosPaseDeLista, DatosRegistroDePase } from "../../domain/PaseDeLista";

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Traduce el JSON de `POST /pases-de-lista` a los datos que espera el dominio.
 * Solo comprueba la *forma* (objeto, arreglo); las reglas de negocio las valida el dominio.
 */
export function aDatosPaseDeLista(cuerpo: unknown): DatosPaseDeLista {
  if (!esObjeto(cuerpo)) throw new ErrorDeValidacion("El cuerpo debe ser un objeto JSON");
  const { sesion, registros, registradoPor } = cuerpo;

  if (!esObjeto(sesion)) throw new ErrorDeValidacion("sesion es obligatoria y debe ser un objeto");
  if (!Array.isArray(registros)) throw new ErrorDeValidacion("registros es obligatorio y debe ser un arreglo");

  return {
    sesion: {
      id: sesion["id"],
      grupoId: sesion["grupoId"],
      fecha: sesion["fecha"],
      tipo: sesion["tipo"],
      tema: sesion["tema"],
    },
    registros: registros.map((registro, i): DatosRegistroDePase => {
      if (!esObjeto(registro)) throw new ErrorDeValidacion(`registros[${i}] debe ser un objeto`);
      return {
        id: registro["id"],
        sesionId: registro["sesionId"],
        catequizandoId: registro["catequizandoId"],
        estado: registro["estado"],
        registradoEn: registro["registradoEn"],
      };
    }),
    registradoPor,
  };
}
