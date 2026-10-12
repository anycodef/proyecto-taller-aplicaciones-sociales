---
name: verificacion
description: Verifica tareas SIGECAT con tests, tipos, lint, migraciones y cobertura; usar antes de cerrar una tarea o preparar su evidencia Agent Trace.
---

# Verificación con evidencia

1. Leer constitución y spec/plan/tasks activos; identificar RF/RNF y tarea. Respetar propiedad de archivos y pausas de instalación. Si npm está suspendido, dejar los checks pendientes; no declararlos aprobados.
2. Con instalación autorizada y PostgreSQL 16/Azurite disponibles, fijar `BD_PRUEBAS_URL` a la base administrativa de pruebas (`postgresql://postgres:postgres@localhost:55432/sigecat` con Compose; ajustar si se usa `PUERTO_POSTGRES`). CI publica PostgreSQL en 5432. `BD_URL` nunca apunta a producción: globalSetup crea y migra bases aisladas. Sin PostgreSQL, la integración debe fallar claramente, nunca omitirse.
3. Ejecutar `npm test`, `npm run typecheck`, `npm run lint`; ejecutar también typecheck/lint/build del API. Corregir fallos sin borrar, omitir ni debilitar tests. No cerrar con rojo.
4. Ejecutar `npm run verificar-migraciones --prefix api -- origin/main` y `node scripts/verificar-cobertura-rf.mjs` (informe; bloqueo de una spec solo al cerrar esa spec). Un informe textual de RF no sustituye tests de comportamiento.
5. Si cambia infraestructura: compilar `infra/main.bicep`, ejecutar `node --test api/pruebas/infra/plantilla.test.mjs`, actionlint y `git diff --check`. Usar `BICEP_BIN` para CLI independiente o Azure CLI. No generar plantillas compiladas dentro del repositorio.
6. What-if, despliegue, cuota/región, TLS real, host key, retención Blob y carga k6 requieren cuenta Azure/evidencia propia. Inventariar grupos Flex y conexiones auxiliares: 15 conexiones por grupo, nunca 15 globales. No acreditar frontend, Expo/dispositivo ni integración 004–008 con falsos.
7. Agent Trace: archivos propios, tarea/RF, fecha, comando/salida, pendientes y bloqueo. No guardar cuerpos, tokens ni datos de menores. Hacer commits solo por petición explícita.
