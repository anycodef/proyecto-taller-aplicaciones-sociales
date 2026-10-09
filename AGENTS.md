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
- Tests: `npm test` — aún no existe; lo agrega la primera spec (`jest-expo`).

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
