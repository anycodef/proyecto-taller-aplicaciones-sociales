import type { Paso } from "./tipos";

export type EntradaPaso = {
  conteo: number;
  fichaFirmada: boolean;
  retirado: boolean;
};

export type ResultadoPaso = {
  paso: Paso;
  sinFicha: boolean;
};

export function calcularPaso({ conteo, fichaFirmada, retirado }: EntradaPaso): ResultadoPaso {
  const sinFicha = !fichaFirmada;

  if (retirado) {
    return { paso: "retirado", sinFicha };
  }

  if (conteo >= 4) {
    return { paso: "alerta_retiro", sinFicha };
  }

  if (conteo === 3) {
    return fichaFirmada ? { paso: "seguimiento", sinFicha: false } : { paso: "citacion", sinFicha: true };
  }

  if (conteo === 2) {
    return { paso: "contacto", sinFicha };
  }

  return { paso: "sin_riesgo", sinFicha };
}
