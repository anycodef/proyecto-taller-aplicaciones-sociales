import appConfig from "../../app.json";
import assetLinks from "../../public/.well-known/assetlinks.json";
import configuracionWeb from "../../public/staticwebapp.config.json";

type Plugin = string | [string, Record<string, unknown>];

test("RNF-103: staticwebapp.config.json declara HSTS y Referrer-Policy no-referrer", () => {
  const cabeceras = configuracionWeb.globalHeaders ?? {};

  expect(cabeceras["Referrer-Policy"]).toBe("no-referrer");
  expect(String(cabeceras["Strict-Transport-Security"])).toContain("max-age=31536000");
  expect(cabeceras["Content-Security-Policy"]).toContain("default-src 'self'");
  expect(configuracionWeb.navigationFallback?.rewrite).toBe("/index.html");
});

test("RNF-103: app.json declara el App Link de /acceso con autoVerify", () => {
  const expo = appConfig.expo as { android?: { intentFilters?: { data?: { pathPrefix?: string } }[] } };
  const filtro = expo.android?.intentFilters?.[0];

  expect(filtro?.data?.pathPrefix).toBe("/acceso");
});

test("RNF-103: assetlinks.json declara el paquete Android y deja la huella de EAS para completar", () => {
  const relacion = assetLinks[0];

  expect(relacion.target.namespace).toBe("android_app");
  expect(relacion.target.package_name).toBe("org.sigecat.app");
  expect(relacion.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
  expect(relacion.target.sha256_cert_fingerprints[0]).toContain("REEMPLAZAR");
});

test("infra: el plugin de expo-secure-store sigue excluyendo la copia de seguridad", () => {
  const expo = appConfig.expo as { plugins?: Plugin[] };
  const plugin = expo.plugins?.find((entrada) =>
    Array.isArray(entrada) ? entrada[0] === "expo-secure-store" : entrada === "expo-secure-store"
  );

  expect(Array.isArray(plugin) ? plugin[1] : {}).toMatchObject({ configureAndroidBackup: false });
});
