{
  "version": "1.0",
  "fecha": "2026-11-11",
  "agente": "OpenCode",
  "modelo": "minimax-m3.1-flash-free",
  "tarea": "T001-81",
  "solicitud": "El usuario pide aplicar el cambio 1: WEB-01 sin \"Pegar enlace\" en web",
  "commitPrevisto": "feat(cliente): quitar pegar enlace y adaptar la copia de inicio en la web",
  "alcance": [
    "src/app/index.tsx",
    "src/lib/seguridad/variantes-plataforma.ts",
    "src/__tests__/variantes-plataforma.test.tsx",
    "docs/agent-trace/cliente-t001-81-web.md"
  ],
  "criterio": "Catalogo de pantallas WEB-01 (Inicio sin enlace, antes p-01, cambio mod): la web no ofrece Pegar enlace y su tarjeta dice que el enlace se abre aqui sin instalar nada. La app del equipo (APP-01) conserva el boton en Android y su texto actual.",
  "comprobaciones": ["npm run test:app", "npm run typecheck", "npm run lint"],
  "resultados": {
    "tests": "Pasan los tests de la tarea dentro de la suite del cliente",
    "typecheck": "Pasa raiz y API",
    "lint": "Pasa sin errores ni advertencias"
  },
  "notas": "La diferencia de copia entre app y web queda en un modulo puro de src/lib, con tests propios, para que las pantallas de la web no se reimplementen: solo cambia el texto y la visibilidad del boton. El boton Pegar enlace se mantiene solo en Android, como pide la tarea T001-81. La imagen web-01.png todavia muestra el boton: es una contradiccion entre el mockup y el catalogo, y se reporta sin resolver."
}
