# Spec 010 — Bitácora de IA de la tarea 4

## Alcance autorizado

Únicamente el punto 1 de la tarea 4: registrar al menos 12 usos de IA generativa
ya evidenciados en `docs/agent-trace/`. Entrega documental en `docs/tarea4/`,
en la rama `tarea4/ia-arquitectura`. El usuario autorizó crear esta spec el
2026-11-01. No se implementan otros puntos de la tarea 4.

## Requisitos

- **RF-1001.** La bitácora deberá incluir al menos 12 usos distintos, cada uno con
  tarea, fecha, herramienta, modelo, prompt resumido, resultado (aceptado,
  modificado o descartado), verificación y enlace a su traza fuente.
- **RF-1002.** La bitácora deberá distinguir solicitudes registradas de prompts
  reconstruidos; decisiones inferidas de resultados explícitos; y verificaciones
  históricas de comprobaciones actuales, sin inventar ejecuciones ni aprobación.
- **RNF-1001.** Los enlaces locales de la bitácora deberán resolver dentro del
  repositorio y las herramientas y modelos deberán coincidir con las trazas.

## Aceptación

Cada requisito tendrá una prueba documental con su identificador. Se ejecutarán
además `npm test`, `npm run typecheck` y `npm run lint`. Una limitación del entorno
o un fallo preexistente se registrará como pendiente, sin declarar cierre aprobado.
No se añaden dependencias ni se cambia el modelo de datos ni la constitución.
