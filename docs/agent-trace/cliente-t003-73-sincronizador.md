{
  "version": "1.0",
  "fecha": "2026-11-11",
  "agente": "OpenCode",
  "modelo": "minimax-m3.1-flash-free",
  "tarea": "T003-73",
  "solicitud": "El usuario pide trabajar la spec 003 con el flujo de marcar asistencia sin internet y sincronizar despues sin duplicados",
  "commitPrevisto": "feat(asistencia): almacen local y motor de sincronizacion sin duplicados",
  "alcance": [
    "specs/003-asistencia-dominical/spec.md",
    "package.json",
    "package-lock.json",
    "jest.config.js",
    "jest.setup.js",
    "src/lib/sincronizacion/almacen-local.ts",
    "src/plataforma/asistencia/almacen-local.ts",
    "src/plataforma/asistencia/sincronizador.ts",
    "src/plataforma/asistencia/__tests__/sincronizador.test.ts"
  ],
  "criterio": "T003-73: motor de sincronizacion del cliente. Baja la nomina con el pull, envia lo pendiente con el push y retira del celular lo que el servidor acepto. Como la marca se identifica con un id determinista y el servidor ignora los repetidos, reenviar no duplica.",
  "comprobaciones": ["npm test", "npm run typecheck", "npm run lint"],
  "resultados": {
    "tests": "Cliente: 36 suites y 116 tests en verde",
    "typecheck": "Pasa raiz y API",
    "lint": "Pasa sin errores ni advertencias"
  },
  "notas": "Mientras la prueba tecnica de la fase 0 no decida la base local, el almacen es un archivo JSON con el mismo protocolo pull/push ya definido; se justifica expo-file-system en la spec antes de instalarlo y el dominio no depende del adaptador, de modo que cambiar la base no cambia las reglas. El sincronizador no guarda: devuelve el estado resultante y quien lo llama decide, para que una marca registrada durante el push no se pierda. Se anade el mock oficial de NetInfo a la configuracion de Jest: sin el modulo nativo la libreria no puede iniciar y ninguna prueba que monte el arbol de rutas podia ejecutarse."
}
