{
  "version": "1.0",
  "fecha": "2026-11-11",
  "agente": "OpenCode",
  "modelo": "minimax-m3.1-flash-free",
  "tarea": "T003-82",
  "solicitud": "El usuario pide el flujo de abrir la lista y marcar asistencia sin internet",
  "commitPrevisto": "feat(asistencia): pantalla de lista de catequesis con presentes por defecto",
  "alcance": [
    "src/app/(equipo)/asistencia/lista/[grupoId].tsx",
    "src/components/asistencia/fila-nino.tsx",
    "src/app/(equipo)/_layout.tsx",
    "src/plataforma/asistencia/contexto-asistencia.tsx"
  ],
  "criterio": "T003-82: la pantalla de lista de catequesis abre con todos presentes y un toque los pasa a ausente. Al confirmar, la marca queda en el celular y, si hay red, se envia en el acto.",
  "comprobaciones": ["npm test", "npm run typecheck", "npm run lint"],
  "resultados": {
    "tests": "Cliente: 36 suites y 116 tests en verde",
    "typecheck": "Pasa raiz y API",
    "lint": "Pasa sin errores ni advertencias"
  },
  "notas": "La lista se arma con la nomina ya descargada en el celular, no con una peticion: por eso funciona sin conexion. Confirmar guarda una marca por nio con el id determinista, de modo que volver a confirmar la misma lista no genera marcas nuevas. La pantalla avisa que sin conexion la lista se guarda en el celular. Se anade la ruta al grupo (equipo) con su guarda por rol."
}
