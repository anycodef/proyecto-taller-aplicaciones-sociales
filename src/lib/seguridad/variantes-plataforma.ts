/**
 * Diferencias de copia entre la app del equipo (APP) y la web de familia
 * (WEB). El catalogo de pantallas define cual es la correcta en cada caso.
 * Este modulo arranca con APP-01 / WEB-01.
 */

export type VariantePlataforma = "app" | "web";

export function varianteDe(platform: string): VariantePlataforma {
  return platform === "web" ? "web" : "app";
}

export const TARJETA_INICIO: Record<VariantePlataforma, string> = {
  app: "La coordinación te lo envía por WhatsApp. Tócalo y la app se abre sola.",
  web: "La coordinación te lo envía por WhatsApp. Tócalo y se abre aquí, sin instalar nada.",
};

/** La web no ofrece pegar el enlace: se abre desde el mensaje. */
export function muestraPegarEnlace(platform: string): boolean {
  return platform === "android";
}
