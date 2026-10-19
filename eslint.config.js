// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist: salida de `expo export`. .log4brains: sitio de ADRs generado. .expo: tipos de ruta generados.
    ignores: ["dist/**", "api/dist/**", ".log4brains/**", "coverage/**", "api/coverage/**", ".expo/**"],
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: ["react", "react-native", "expo", "expo-*", "@/plataforma/*", "@nozbe/*"] }] },
  },
  {
    files: ["api/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: ["react", "react-native", "expo", "expo-*", "@nozbe/*"] }] },
  },
  { files: ["api/*.js"], languageOptions: { globals: { __dirname: "readonly", module: "readonly", require: "readonly" } } },
  {
    files: ["api/pruebas/carga/*.k6.js"],
    languageOptions: { globals: { __ENV: "readonly", __VU: "readonly" } },
    settings: { "import/core-modules": ["k6", "k6/http", "k6/data", "k6/crypto"] },
  },
]);
