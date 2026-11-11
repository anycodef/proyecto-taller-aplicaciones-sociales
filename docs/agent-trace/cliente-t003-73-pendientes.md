{
  "version": "1.0",
  "fecha": "2026-11-11",
  "agente": "OpenCode",
  "modelo": "minimax-m3.1-flash-free",
  "tarea": "T003-73",
  "solicitud": "El usuario pide trabajar la spec 003 con el flujo de marcar asistencia sin internet y sincronizar despues sin duplicados",
  "commitPrevisto": "feat(asistencia): dominio de marcas pendientes con id determinista",
  "alcance": [
    "src/lib/asistencia/pendientes.ts",
    "src/lib/asistencia/__tests__/pendientes.test.ts",
    "jest.config.js"
  ],
  "criterio": "Base del flujo sin duplicados: la marca de asistencia se identifica con un id determinista (sesion, nio, tipo de registro), de modo que confirmar dos veces la misma lista o reenviar el push no generan marcas nuevas. El lote de push lleva cada fila una sola vez, sin la metadata local ni el feedback del servidor.",
  "comprobaciones": ["npm run test:app", "npm run typecheck", "npm run lint"],
  "resultados": {
    "tests": "Pasan los tests de la tarea dentro de la suite del cliente",
    "typecheck": "Pasa raiz y API",
    "lint": "Pasa sin errores ni advertencias"
  },
  "notas": "El modulo es puro, sin React ni Expo: las filas viajan en snake_case como las tablas del servidor y el push usa el protocolo de src/lib/sincronizacion. Se anade uuid a transformIgnorePatterns del preset de jest-expo porque el paquete viene en ESM y el preset no lo transformaba, de modo que ningun test del dominio de asistencia podia ejecutarse. El dominio no depende de la base local: el adaptador de disco y el motor de sincronizacion van aparte, para que la decision de la prueba tecnica (WatermelonDB o plan B) no cambie estas reglas."
}
