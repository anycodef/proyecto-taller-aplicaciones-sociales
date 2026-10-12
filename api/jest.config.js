const comunes = {
  rootDir: __dirname,
  testEnvironment: "node",
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }] },
  moduleNameMapper: { "^@/lib/(.*)$": "<rootDir>/../src/lib/$1" },
};
module.exports = {
  testTimeout: 30000,
  projects: [
    { ...comunes, displayName: "unit", testMatch: ["<rootDir>/test/unit/**/*.test.ts", "<rootDir>/test/http/**/*.test.ts"] },
    { ...comunes, displayName: "integracion", testMatch: ["<rootDir>/test/integracion/**/*.test.ts", "<rootDir>/test/e2e/**/*.test.ts"], globalSetup: "<rootDir>/test/soporte/global-setup.ts", globalTeardown: "<rootDir>/test/soporte/global-teardown.ts" },
  ],
};
