# Prompt P3 — Microservicio de actualización (gRPC)

Sigue primero `docs/tarea-3/prompts/_comun.md`.

**Eres P3.** Rama: `tarea3/p3-actualizacion`. Directorio propio: `tarea3/servicio-actualizacion/`.
**Tareas:** T009-31 a T009-37. Requisitos: RF-903, RF-905, RF-906, RF-908.

Implementa el servicio gRPC del contrato `tarea3/contratos/sigecat.proto` (puerto 50051) con `@grpc/grpc-js` y `@grpc/proto-loader`.
- Interceptor que verifica el JWT de la metadata `authorization` con `compartido/auth.ts` (de P5; mientras llega, usa un doble local sin copiarlo). Rol/alcance incorrecto → `PERMISSION_DENIED`.
- `RegistrarAsistencia`: idempotente por `id` (si existe, `repetido = true`, sin duplicar).
- `RegistrarAsistenciaLote` (client streaming): una transacción, devuelve registrados/repetidos/rechazados.
- `RegistrarJustificacion`: crea la justificación y marca la asistencia como JUSTIFICADA.
- `RecalcularRiesgo`: usa `compartido/riesgo.ts` (P5) y persiste en `riesgo`.
- `ObservarAsistencia` (server streaming): emite eventos de nuevas asistencias del grupo usando `LISTEN/NOTIFY` de PostgreSQL; el evento lleva `identidad_operativa`, nunca nombre real.
- Cierre ordenado (SIGTERM) y verificación de salud.
- Pruebas con un cliente gRPC real contra la BD de pruebas; prueba explícita de idempotencia, de un CAT escribiendo en otro grupo y de SUP intentando escribir.
