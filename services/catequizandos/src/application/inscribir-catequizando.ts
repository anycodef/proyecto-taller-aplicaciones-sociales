import { Catequizando, type DatosCatequizando } from "../domain/catequizando";
import type { CatequizandoRepository } from "../domain/catequizando-repository";
import type { Consentimiento } from "../domain/consentimiento";
import type { GrupoRepository } from "../domain/grupo-repository";
import type { Reloj } from "../domain/reloj";

export type OrdenDeInscripcion = {
  grupoId: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  consentimiento: Partial<Consentimiento> | null | undefined;
};

export class InscribirCatequizando {
  constructor(
    private readonly catequizandos: CatequizandoRepository,
    private readonly grupos: GrupoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(orden: OrdenDeInscripcion): Promise<DatosCatequizando> {
    const grupoExiste = typeof orden.grupoId === "string" && (await this.grupos.existe(orden.grupoId));

    // Los invariantes viven en el agregado; el caso de uso solo aporta lo que el dominio no puede consultar.
    const catequizando = Catequizando.inscribir(
      { ...orden, id: this.catequizandos.siguienteId() },
      { ahora: this.reloj.ahora(), grupoExiste },
    );

    await this.catequizandos.guardar(catequizando);
    return catequizando.aDetalle();
  }
}
