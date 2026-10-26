# Bloqueo de la demostración real del agente

Fecha de comprobación: 2026-10-26.

No se generó `agente-transcripcion.md` porque el servicio GraphQL requerido por el servidor MCP no está publicado. Después de ejecutar `git fetch --all --prune` y consultar las ramas remotas, no existe `origin/tarea3/p2-consulta` ni otra rama con `tarea3/servicio-consulta/`.

P1, P3 y P5 sí publicaron sus ramas. La propia evidencia de P5 indica que el recorrido GraphQL → gRPC → GraphQL permanece omitido hasta integrar P2.

Pendiente para obtener evidencia válida:

1. P2 publica e integra `tarea3/servicio-consulta/`.
2. Se ejecuta `npm --prefix tarea3 run demo` sin recorridos omitidos.
3. Se ejecuta `tarea3/agente/guion.md` con Claude Code usando solo MCP.
4. Se guardan la transcripción y la medición real en `tarea3/evidencia/`.

Este archivo registra el bloqueo; no sustituye la transcripción exigida por RF-910.
