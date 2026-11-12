import type { ClienteHttp } from "@/lib/seguridad/api";
import type { FaltaClasificada, Paso } from "./tipos";

/** Fila de `GET /riesgo`: calculada en el servidor; el celular no recalcula (APP-64). */
export type FilaRiesgo = {
  catequizandoId: string;
  nombre: string;
  grupoId: string;
  grupoNombre: string;
  paso: Paso;
  conteo: number;
  sinFicha: boolean;
  pendientesJustificar: number;
  faltasOrigen: FaltaClasificada[];
};

export function crearApiRiesgo(cliente: ClienteHttp) {
  return {
    listarRiesgo: (): Promise<FilaRiesgo[]> => cliente.solicitar<FilaRiesgo[]>("GET", "/riesgo"),
  };
}
export type ApiRiesgo = ReturnType<typeof crearApiRiesgo>;
