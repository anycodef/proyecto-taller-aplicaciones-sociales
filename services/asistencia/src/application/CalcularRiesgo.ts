import { RegistroRepositorio } from "../domain/RegistroRepositorio";
import { calcularSenalRiesgo, SenalRiesgo } from "../domain/SenalRiesgo";
import { textoNoVacio } from "../domain/SesionCatequesis";
import { Reloj } from "./Reloj";

/**
 * Caso de uso: señal de riesgo de un catequizando, calculada al momento.
 * Solo orquesta (leer historial, aplicar la regla, fijar la hora): la regla vive en el dominio.
 */
export class CalcularRiesgo {
  constructor(
    private readonly registros: RegistroRepositorio,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(catequizandoId: string): Promise<SenalRiesgo> {
    const id = textoNoVacio(catequizandoId, "catequizandoId");
    const historial = await this.registros.listarPorCatequizando(id);
    return calcularSenalRiesgo(id, historial, this.reloj());
  }
}
