{
  "version": "1.0",
  "fecha": "2026-11-11",
  "agente": "OpenCode",
  "modelo": "minimax-m3.1-flash-free",
  "tarea": "T003-84",
  "solicitud": "El usuario pide que al volver la conexion se sincronice sin duplicados",
  "commitPrevisto": "feat(asistencia): pantalla de por enviar y sincronizacion al reconectar",
  "alcance": [
    "src/app/(equipo)/asistencia/pendientes.tsx",
    "src/plataforma/asistencia/contexto-asistencia.tsx",
    "src/__tests__/flujo-asistencia.test.tsx"
  ],
  "criterio": "T003-84: la pantalla muestra los registros por enviar y el proveedor sincroniza solo al volver la conexion. El envio lleva ids deterministas, el servidor ignora los repetidos y lo aceptado se retira del celular.",
  "comprobaciones": ["npm test", "npm run typecheck", "npm run lint"],
  "resultados": {
    "tests": "Cliente: 36 suites y 116 tests en verde",
    "typecheck": "Pasa raiz y API",
    "lint": "Pasa sin errores ni advertencias"
  },
  "notas": "La prueba del flujo recorre lo que pidio el equipo: abrir la lista, marcar un nino sin red, comprobar que la marca queda en el celular y, al volver la conexion, comprobar que se envia una sola vez y que no quedan pendientes. El proveedor es el unico dueno del estado: el pull no pisa una marca registrada durante el push. Si el servidor rechaza algo, la marca se conserva para el siguiente intento y se avisa en pantalla."
}
