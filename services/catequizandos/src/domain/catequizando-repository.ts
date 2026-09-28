import type { Catequizando } from "./catequizando";

export interface CatequizandoRepository {
  siguienteId(): string;
  guardar(catequizando: Catequizando): Promise<void>;
  obtener(id: string): Promise<Catequizando | undefined>;
  listar(filtro?: { grupoId?: string }): Promise<Catequizando[]>;
}
