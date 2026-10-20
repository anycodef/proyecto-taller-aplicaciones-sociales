# Prompt P1 — Análisis, decisión y documento final

Sigue primero `docs/tarea-3/prompts/_comun.md`.

**Eres P1.** Rama: `tarea3/p1-analisis`. Directorio propio: `docs/tarea-3/` (excepto `evidencia.md` y `ejecutar.md`, que son de P5) y `docs/adr/`.
**Tareas:** T009-11 a T009-18.

Contexto del enunciado del profesor:
1. Identificar funcionalidades donde aplique GraphQL y gRPC, para consultas y para actualizaciones; validar si aplica al proyecto y justificar.
2. Demo funcional (la hacen P2, P3, P4, P5).
3. Si un agente de IA usara esos microservicios: ¿GraphQL, gRPC o herramienta MCP? Justificar.

Lo que debes producir:
- `docs/tarea-3/matriz-aplicabilidad.md`: mínimo 10 funcionalidades reales de SIGECAT sacadas de las specs 001–008 (ficha de catequizando, lista de asistencia del domingo, sync offline, justificaciones con evidencia, avance en oraciones, tablero de riesgo de deserción, aptitud sacramental, historial de ciclos, enlaces de familia, auditoría...). Columnas: funcionalidad · tipo (consulta/actualización) · protocolo recomendado (REST actual / GraphQL / gRPC / ninguno) · aplicable sí/no · justificación atada a R1–R27 y a la constitución. **Sé honesto**: la app móvil offline-first con WatermelonDB no gana nada con GraphQL/gRPC en el transporte de sync, y gRPC no corre directo en React Native/Expo ni en Azure Functions; justifica dónde sí (paneles de coordinación con campos a elección = GraphQL; comunicación servicio a servicio, lotes y streaming = gRPC).
- ADR `docs/adr/20261019-graphql-grpc-mcp.md` con `docs/adr/template.md`: contexto, decisión (GraphQL en el borde de consulta, gRPC interno de escritura, MCP para agentes), alternativas, consecuencias.
- `docs/tarea-3/decision-agente-mcp.md`: tabla GraphQL vs gRPC vs MCP para un agente (descubrimiento de capacidades, consumo de contexto/tokens, seguridad y alcance, tipado, streaming, costo de integración) y conclusión justificada. **Respáldala con una medición real**: pide a P4/P5 el tamaño en bytes/tokens de responder «¿quién está en riesgo en el grupo?» por GraphQL directo, por gRPC y por MCP.
- Diagrama de la demo en `docs/diagrams/` y `docs/tarea-3/informe.md` final (análisis, arquitectura, demo, decisión, y una tabla «quién hizo qué» con commits). Guion de exposición de 10 min.

Revisa también los PR de los demás: que cada RF tenga test y que la matriz no contradiga la implementación.
