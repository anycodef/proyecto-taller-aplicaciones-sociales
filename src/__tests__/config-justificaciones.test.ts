import appConfig from "../../app.json";
import paquete from "../../package.json";

type Plugin = string | [string, Record<string, unknown>];

test("RF-402 RNF-404: el picker pide la cámara en español y sin micrófono", () => {
  const plugins = (appConfig.expo.plugins ?? []) as Plugin[];
  const picker = plugins.find((p) => Array.isArray(p) && p[0] === "expo-image-picker") as [string, Record<string, unknown>] | undefined;
  expect(picker?.[1].cameraPermission).toMatch(/cámara.*comprobante/);
  expect(picker?.[1].microphonePermission).toBe(false);
});

test("RNF-402 RNF-404: las dependencias de imagen siguen el SDK 57", () => {
  const dependencias = paquete.dependencies as Record<string, string>;
  for (const nombre of ["expo-image-picker", "expo-image-manipulator", "expo-file-system", "expo-image"]) expect(dependencias[nombre]).toMatch(/^~57\./);
});
