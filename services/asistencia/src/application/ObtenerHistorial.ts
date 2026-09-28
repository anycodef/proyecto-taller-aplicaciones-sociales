import { EstadoAsistencia } from "../domain/EstadoAsistencia";
import { RegistroRepositorio } from "../domain/RegistroRepositorio";
import { registrosVigentesPorSesion } from "../domain/SenalRiesgo";
import { SesionCatequesis, TipoSesion, textoNoVacio } from "../domain/SesionCatequesis";
import { SesionRepositorio } from "../domain/SesionRepositorio";

export type EntradaDeHistorial = { fecha: string; tipo: TipoSesion; estado: EstadoAsistencia };

/**
 * Caso de uso: historial de un catequizando, del más antiguo al más reciente.
 * No verifica que el catequizando exista (es otro contexto): sin registros devuelve [].
 */
export class ObtenerHistorial {
  constructor(
    private readonly sesiones: SesionRepositorio,
    private readonly registros: RegistroRepositorio,
  ) {}

  async ejecutar(catequizandoId: string): Promise<EntradaDeHistorial[]> {
    const id = textoNoVacio(catequizandoId, "catequizandoId");
    const vigentes = registrosVigentesPorSesion(await this.registros.listarPorCatequizando(id));
    const sesiones = await this.sesiones.buscarPorIds(vigentes.map((r) => r.sesionId));
    const sesionPorId = new Map<string, SesionCatequesis>(sesiones.map((s) => [s.id, s]));

    return vigentes
      .flatMap((registro) => {
        const sesion = sesionPorId.get(registro.sesionId);
        return sesion ? [{ fecha: sesion.fecha, tipo: sesion.tipo, estado: registro.estado }] : [];
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
  }
}
