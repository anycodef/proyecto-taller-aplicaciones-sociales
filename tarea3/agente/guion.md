# Guion de demostración del agente SIGECAT

## Preparación

1. Ejecutar la demo integrada desde `tarea3/` y confirmar que GraphQL responde en `http://localhost:4000/graphql`.
2. Emitir un token `COORD` y exportarlo como `SIGECAT_TOKEN`.
3. Iniciar Claude Code desde `tarea3/` y confirmar con `/mcp` que el servidor `sigecat` está conectado.
4. Usar únicamente herramientas MCP durante el recorrido.

Grupo ficticio de la demostración: `11111111-1111-1111-1111-111111111101`.
Catequizando ficticio para la escritura: `22222222-2222-2222-2222-222222222101`.

## Preguntas

1. «¿Qué niños del grupo `11111111-1111-1111-1111-111111111101` están en riesgo MEDIO o ALTO y por qué? Consulta los detalles necesarios usando solo las herramientas de SIGECAT».
2. «Registra como PRESENTE al catequizando `22222222-2222-2222-2222-222222222101` el domingo `2026-10-25` usando SIGECAT. Indica el UUID generado y si fue repetido».
3. «Recalcula su riesgo y dime si cambió. Explica el resultado usando solo los datos devueltos por SIGECAT».

## Evidencia esperada

- La lista inicial identifica riesgos sin datos protegidos.
- La escritura devuelve su UUID y `repetido`.
- La consulta posterior refleja el cambio.
- La transcripción completa se guarda en `tarea3/evidencia/agente-transcripcion.md`.
