declare const process: { env: { [clave: string]: string | undefined } };

/** Metro reemplaza en linea las variables EXPO_PUBLIC_* al empaquetar. */
export const ES_DESARROLLO = process.env.NODE_ENV !== "production";

export const URL_API_LOCAL = "http://localhost:7071/api";

/** Base HTTPS de la API en APIM. En desarrollo cae a las Functions locales. */
export function urlBaseApi(): string {
  const configurada = process.env.EXPO_PUBLIC_URL_API;
  if (configurada) return configurada.replace(/\/+$/, "");
  return ES_DESARROLLO ? URL_API_LOCAL : "";
}

/** Clave de suscripcion del producto de APIM. */
export function claveSuscripcionApi(): string | undefined {
  return process.env.EXPO_PUBLIC_CLAVE_APIM || undefined;
}
