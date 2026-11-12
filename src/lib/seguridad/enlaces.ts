export const LONGITUD_TOKEN_BYTES = 32;
export function construirUrlEnlace(base: string, tipo: "equipo" | "familia", token: string): string {
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("enlace_requiere_https");
  url.pathname = `/acceso/${tipo}`;
  url.search = "";
  url.hash = `t=${encodeURIComponent(token)}`;
  return url.toString();
}
export function extraerTokenDeUrl(url: string): string | null {
  try { return new URLSearchParams(new URL(url).hash.slice(1)).get("t"); } catch { return null; }
}
export type EnlaceAcceso = { tipo: "equipo" | "familia"; token: string };
/** El tipo sale de la ruta del enlace: un enlace de familia activado como equipo falla en el servidor. */
export function leerEnlaceAcceso(texto: string): EnlaceAcceso | null {
  const token = extraerTokenDeUrl(texto.trim());
  if (!token) return null;
  try {
    const tipo = new URL(texto.trim()).pathname.replace(/\/+$/, "").endsWith("/acceso/familia") ? "familia" : "equipo";
    return { tipo, token };
  } catch { return null; }
}
