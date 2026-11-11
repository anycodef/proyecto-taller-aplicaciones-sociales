{
  "version": "1.0",
  "fecha": "2026-11-11",
  "agente": "OpenCode",
  "modelo": "minimax-m3.1-flash-free",
  "tarea": "T003-77",
  "solicitud": "El usuario pide el flujo de la asistencia dominical",
  "commitPrevisto": "feat(asistencia): menu de pasar lista",
  "alcance": [
    "src/app/(equipo)/asistencia/index.tsx",
    "src/app/(equipo)/asistencia.tsx"
  ],
  "criterio": "T003-77: la pantalla asistencia/index.tsx sustituye a asistencia.tsx y muestra el estado de la conexion, los registros por enviar, los grupos con su nomina y el boton de sincronizar.",
  "comprobaciones": ["npm test", "npm run typecheck", "npm run lint"],
  "resultados": {
    "tests": "Cliente: 36 suites y 116 tests en verde",
    "typecheck": "Pasa raiz y API",
    "lint": "Pasa sin errores ni advertencias"
  },
  "notas": "El menu muestra solo los grupos ya descargados: sin conexion sigue sirviendo para pasar lista. El estado de conexion se avisa con la insignia y con el aviso de que los registros quedan en el celular. La URL sigue siendo /asistencia. El archivo asistencia.tsx se borro y lo sustituye asistencia/index.tsx, pero ese borrado quedo en el commit anterior (0f8bae9), que ya estaba preparado: se anota aqui para que el rastro sea honesto."
}
