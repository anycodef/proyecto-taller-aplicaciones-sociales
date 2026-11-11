import { clasificarFalta } from "./clasificar-falta";
import { contarFaltas } from "./conteo";
import { calcularPaso } from "./pasos";
import type { EntradaRiesgo, EstadoRiesgo, FaltaClasificada } from "./tipos";

export function evaluarRiesgo(entrada: EntradaRiesgo, ahora: Date = new Date()): EstadoRiesgo {
  const justificaciones = entrada.justificaciones ?? [];

  const clasificadas: FaltaClasificada[] = entrada.faltas.map((falta) => ({
    catequizandoId: falta.catequizandoId,
    fecha: falta.fecha,
    origen: falta.origen,
    sesionIds: falta.sesionIds,
    estado: clasificarFalta(falta, justificaciones, ahora),
  }));

  const { conteo, faltasOrigen, pendientesJustificar } = contarFaltas(clasificadas, entrada.saldo);
  const fichaFirmada = entrada.fichaFirmada ?? entrada.saldo?.fichaFirmada ?? false;
  const { paso, sinFicha } = calcularPaso({
    conteo,
    fichaFirmada,
    retirado: entrada.retirado ?? false,
  });

  return {
    catequizandoId: entrada.catequizandoId,
    paso,
    conteo,
    sinFicha,
    pendientesJustificar,
    faltasOrigen,
  };
}
