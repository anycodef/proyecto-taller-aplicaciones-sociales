# AGENTS.md — SIGECAT

## Proyecto
Aplicación móvil para la gestión de la catequesis parroquial de niños de 8 a 13 años:
perfil único del catequizando, asistencia a misa y catequesis, justificaciones con
evidencia, avance en oraciones y doctrina, y alerta temprana de deserción. La usan
coordinación, catequistas (muchos menores de edad) y familias.

## Antes de tocar código
1. Lee `docs/constitution.md`. Sus principios son innegociables y prevalecen sobre todo lo demás.
2. Lee la spec activa en `specs/NNN-nombre/` (`spec.md`, `plan.md`, `tasks.md`).
3. Si la tarea no está en una spec, detente y pide que se escriba primero.
4. Expo cambió: consulta https://docs.expo.dev/versions/v57.0.0/ antes de usar cualquier API de Expo.

## Comandos
- Instalar: `npm install`
- Ejecutar: `npm start` (Expo Go) · `npm run android` · `npm run web`
- Tipos: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test` — cliente con `jest-expo` y API, incluida integración PostgreSQL (`BD_PRUEBAS_URL`).
- Backend: `npm --prefix api install`, `npm --prefix api run build`, `npm --prefix api start`. Desarrollo: `docs/backend-desarrollo.md`.
- OpenAPI: `node api/scripts/verificar-openapi.mjs`; no requiere dependencias adicionales.

## Estructura
- `src/app/` — rutas de Expo Router, una pantalla por archivo. Solo presentan y delegan.
- `src/components/` — componentes de interfaz compartidos.
- `src/lib/` — lógica de negocio en TypeScript puro; prohibido importar React, React Native o Expo.
- `specs/` — specs de cada funcionalidad. `docs/adr/` — decisiones de arquitectura (Log4brains).

## Estilo
- Código, identificadores, nombres de archivo, textos de interfaz y documentación en español.
- Identificadores y nombres de archivo sin tildes ni `ñ` (`diseno`, `anadir`); los textos visibles sí las llevan.
- `camelCase` para variables y funciones, `PascalCase` para tipos y componentes, `kebab-case` para archivos.
- Importa con el alias `@/` (`@/lib/domain/modelo`).
- Comentarios solo para explicar el porqué, no el qué.

## Reglas
- Acuerdos backend 001–003 (2026-10-11): alcance backend completo, incluidas fases posteriores al primer corte; decisiones de los planes aceptadas, implementación y verificaciones físicas/despliegue pendientes de evidencia. Contratos: `docs/backend-contratos.md`; seguimiento: `docs/backend-implementacion.md`.
- HTTP: camelCase español; excepción de transporte WatermelonDB conserva `changes`, `timestamp`, `experimentalStrategy`, `created`, `updated`, `deleted`, colecciones plurales y filas snake_case; adaptadores españoles internos opcionales. PostgreSQL: tablas singulares snake_case. QR exclusivamente `SGC1:<uuid>:<emision>` (`codigo_carne` local, `emision` en BD).
- Flex: pool 3 por proceso, 1 worker, 5 instancias por grupo, concurrencia HTTP 10, 2048 MB, always-ready 0, timers UTC. Límites por cuenta en Functions con contador PostgreSQL atómico; APIM global.
- Administración exclusivamente ONLINE según constitución; PIN local, nunca contraseña enviada al servidor. No marcar tareas hechas sin evidencia.
- La pausa temporal de npm durante la instalación del principal terminó. Checks integrales y evidencia final a cargo del principal; no declarar aprobados los que no se ejecutaron. PostgreSQL local usa `PUERTO_POSTGRES` (por defecto 55432).
- No añadas dependencias ni cambies el modelo de datos sin actualizar antes la spec.
- No modifiques archivos dentro de `specs/` ni `docs/constitution.md` salvo petición explícita.
- Cada requisito de la spec tiene un identificador (`RF-001`, `RNF-001`) y al menos un test que lo cita en su nombre.
- Salud, neurodivergencia y documentos de identidad nunca se guardan en el dispositivo ni aparecen en logs.
- La identidad real de un catequista menor de edad nunca sale en vistas, reportes ni exportaciones: usa `identidadOperativa`.
- Todo registro nuevo lleva un UUID generado en el cliente; una migración ya aplicada no se edita.
- Commits con Conventional Commits, uno por tarea, con su registro Agent Trace incluido.

## Al terminar cualquier tarea
- Ejecuta `npm test`, `npm run typecheck` y `npm run lint`, y confirma en tu respuesta que todo pasa.
- Si algo falla, la tarea no está terminada: no omitas, borres ni debilites tests para que pasen.
