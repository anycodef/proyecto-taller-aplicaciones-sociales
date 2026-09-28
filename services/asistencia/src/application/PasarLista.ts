import { DatosPaseDeLista, PaseDeLista } from "../domain/PaseDeLista";
import { RegistroRepositorio } from "../domain/RegistroRepositorio";
import { SesionRepositorio } from "../domain/SesionRepositorio";
import { Reloj } from "./Reloj";

export type ResultadoPasarLista = { sesionId: string; registrosGuardados: number };

/** Caso de uso: guarda una sesión con todos sus registros (upsert idempotente por id). */
export class PasarLista {
  constructor(
    private readonly sesiones: SesionRepositorio,
    private readonly registros: RegistroRepositorio,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosPaseDeLista): Promise<ResultadoPasarLista> {
    const pase = PaseDeLista.crear(datos, this.reloj());
    await this.sesiones.guardar(pase.sesion);
    await this.registros.guardarVarios(pase.registros);
    return { sesionId: pase.sesion.id, registrosGuardados: pase.registros.length };
  }
}
