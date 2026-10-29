# Prompt P4 — Servidor MCP y agente de IA

Sigue primero `docs/tarea-3/prompts/_comun.md`.

**Eres P4.** Rama: `tarea3/p4-mcp`. Directorio propio: `tarea3/servidor-mcp/`, `tarea3/agente/`, `tarea3/.mcp.json`, y tu evidencia `tarea3/evidencia/agente-*`.
**Tareas:** T009-41 a T009-47. Requisitos: RF-909, RF-910, RF-906, RF-907.

Implementa el servidor MCP del contrato `tarea3/contratos/herramientas-mcp.md` (transporte stdio) con `@modelcontextprotocol/sdk` y `zod`.
- Cada herramienta llama a GraphQL (`http://localhost:4000/graphql`, token en `SIGECAT_TOKEN`) pidiendo **solo los campos necesarios** y devuelve JSON corto. Las escrituras generan el UUID aquí y lo devuelven.
- Anotaciones MCP correctas (`readOnlyHint`, `idempotentHint`, `destructiveHint: false`). Ninguna herramienta borra ni lee datos protegidos.
- Un recurso `sigecat://grupo/{id}/riesgo` y el prompt `revision-dominical`.
- Errores controlados: `{"codigo":"fuera_de_alcance"}` con `isError: true`.
- Tests con el cliente MCP del SDK sobre un GraphQL doble: la lista de herramientas coincide con el contrato.
- `tarea3/.mcp.json` para que Claude Code descubra el servidor; `tarea3/agente/guion.md` con las 2–3 preguntas de la demo («¿qué niños del grupo X están en riesgo y por qué?», «registra la asistencia de ... el domingo ...», «¿cambió su riesgo?»). Ejecuta el guion con Claude Code contra la demo corriendo (cuando P2/P3/P5 hayan integrado) y guarda la transcripción real en `tarea3/evidencia/agente-transcripcion.md` y, si puedes, capturas.
- Mide bytes (y tokens aproximados) de la respuesta MCP vs la respuesta GraphQL cruda para la misma pregunta y entrégaselos a P1 (`tarea3/evidencia/medicion-agente.md`).
