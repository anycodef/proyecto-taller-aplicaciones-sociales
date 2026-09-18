// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist: salida de `expo export`. .log4brains: sitio de ADRs generado.
    ignores: ["dist/*", ".log4brains/*"],
  },
]);
