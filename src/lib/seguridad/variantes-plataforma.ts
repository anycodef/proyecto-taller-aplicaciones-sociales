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

export const ETIQUETA_ACTIVACION: Record<VariantePlataforma, string> = {
  app: "ACTIVAR MI CUENTA",
  web: "ENTRANDO",
};

export const TITULO_ACTIVACION: Record<VariantePlataforma, string> = {
  app: "Verificando tu enlace…",
  web: "Abriendo tu enlace…",
};

export const TEXTO_ACTIVACION: Record<VariantePlataforma, string> = {
  app: "Esto toma unos segundos. No cierres la app.",
  web: "Esto toma unos segundos.",
};

/** Aviso de la primera vez, que solo tiene sentido en la app del equipo. */
export const AVISO_PRIMERA_VEZ: Record<VariantePlataforma, string | null> = {
  app: "La primera vez necesitas internet. Si falla, conéctate a datos o wifi y vuelve a abrir el enlace: sigue funcionando.",
  web: null,
};

/**
 * Aviso de registros rechazados. La web de familia no deja registros en cola
 * (la asistencia es de la app del equipo), asi que no lo muestra.
 */
export function avisoRegistrosRechazados(platform: string, cantidad: number): string | null {
  if (varianteDe(platform) === "web") return null;
  const registros = cantidad === 1 ? "registro" : "registros";
  const verbo = cantidad === 1 ? "no pudo enviarse" : "no pudieron enviarse";
  return `${cantidad} ${registros} de este celular ${verbo}. La coordinación ya fue avisada.`;
}

/** Aviso propio de la familia: un mismo enlace sirve para todos sus hijos. */
export const AVISO_VARIOS_HIJOS: Record<VariantePlataforma, string | null> = {
  app: null,
  web: "Si tienes más de un hijo, el mismo enlace sirve para todos.",
};
