import configuracionWeb from "../../public/staticwebapp.config.json";

test("RF-401 RNF-403: la CSP permite subir y ver evidencias solo en el endpoint Blob", () => {
  const csp = String(configuracionWeb.globalHeaders?.["Content-Security-Policy"] ?? "");
  const directiva = (nombre: string) => csp.split(";").map(d => d.trim()).find(d => d.startsWith(`${nombre} `)) ?? "";
  expect(directiva("img-src")).toContain("https://*.blob.core.windows.net");
  expect(directiva("connect-src")).toContain("https://*.blob.core.windows.net");
  expect(directiva("default-src")).toBe("default-src 'self'");
});
