import appConfig from "../../app.json";

type Plugin = string | [string, Record<string, unknown>];

test("infra: app.json declara el paquete Android y excluye la copia de seguridad de expo-secure-store", () => {
  const expo = appConfig.expo as {
    android?: { package?: string };
    plugins?: Plugin[];
  };

  expect(expo.android?.package).toBe("org.sigecat.app");

  const plugin = expo.plugins?.find((entrada) =>
    Array.isArray(entrada) ? entrada[0] === "expo-secure-store" : entrada === "expo-secure-store"
  );

  expect(plugin).toBeDefined();
  expect(Array.isArray(plugin) ? plugin[1] : {}).toMatchObject({ configureAndroidBackup: false });
});
