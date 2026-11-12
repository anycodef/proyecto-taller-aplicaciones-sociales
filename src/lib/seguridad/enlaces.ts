export const LONGITUD_TOKEN_BYTES = 32;
export function construirUrlEnlace(base: string, tipo: "equipo" | "familia", token: string): string {
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("enlace_requiere_https");
  url.pathname = `/acceso/${tipo}`;
  url.search = "";
  url.hash = `t=${encodeURIComponent(token)}`;
  return url.toString();
}
/**
 * El enlace https lleva el token en el fragmento (`#t=`), que el navegador no envía a ningún servidor.
 * Expo Go descarta el fragmento al abrir un `exp://`, así que ese enlace lo lleva en la consulta (`?t=`).
 */
export function extraerTokenDeUrl(url: string): string | null {
  try {
    const enlace = new URL(url);
    return new URLSearchParams(enlace.hash.slice(1)).get("t") ?? enlace.searchParams.get("t");
  } catch {
    return null;
  }
}
