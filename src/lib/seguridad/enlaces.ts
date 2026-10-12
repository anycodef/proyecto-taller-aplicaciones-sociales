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
