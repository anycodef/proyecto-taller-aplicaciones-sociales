import type { EstadoRiesgo, Paso } from "./tipos";

const ORDEN: Record<Paso, number> = {
  alerta_retiro: 0,
  citacion: 1,
  contacto: 2,
  seguimiento: 3,
  sin_riesgo: 4,
  retirado: 5,
};

export function ordenarListaRiesgo(estados: EstadoRiesgo[]): EstadoRiesgo[] {
  return estados
    .filter((estado) => estado.paso !== "sin_riesgo" && estado.paso !== "retirado")
    .sort(
      (a, b) =>
        ORDEN[a.paso] - ORDEN[b.paso] ||
        b.conteo - a.conteo ||
        a.catequizandoId.localeCompare(b.catequizandoId),
    );
}
