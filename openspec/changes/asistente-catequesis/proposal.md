## Why

La coordinación y los catequistas responden una y otra vez las mismas dudas sobre oraciones, sacramentos y doctrina, y las familias no siempre encuentran la respuesta en el material de la parroquia. El proyecto ya cuenta con documentos públicos de catequesis, pero no hay una forma sencilla de consultarlos sin depender de una persona. Un asistente que responda solo con ese material, cite la fuente y no toque datos de menores reduce respuestas inventadas y libera tiempo del equipo.

La constitución exige costo cero, protección de datos de menores y trazabilidad. Por eso el asistente se limita a material público, no consulta la base de datos operativa y usa un proveedor gratuito o local.

## What Changes

- Nueva capacidad `asistente-catequesis` con un asistente de preguntas y respuestas en español.
- Corpus público versionado con fuente y licencia de cada documento.
- Recuperación de fragmentos por relevancia (BM25 en TypeScript puro, sin dependencias nuevas).
- Generación con proveedor gratuito o local, con citas obligatorias y abstención cuando no hay sustento.
- Rechazo de preguntas sobre datos de menores, salud, documentos, situaciones familiares o riesgo.
- Endpoint autenticado `POST /asistente/preguntar` con límite por cuenta y sin historial de conversaciones.
- Pantalla del asistente en la app y método en el cliente HTTP.
- Permiso `asistente:consultar` para los roles autenticados.
- Pruebas de recuperación, citas, abstención, rechazo, cuota, privacidad y caída del proveedor.

## Impact

- Specs afectadas: `asistente-catequesis` (nueva).
- Código afectado: `src/lib/asistente/`, `src/app/asistente.tsx`, `src/plataforma/api/`, `src/lib/seguridad/matriz-permisos.ts`, `api/src/modulos/asistente/`, `api/openapi.json`, inventario de bindings.
- Sin dependencias nuevas: se usa `fetch`, `zod` y PostgreSQL ya presentes.
- Sin cambios en el modelo de datos de asistencia, justificaciones o riesgo.

## Fuera de alcance

- Consultar datos de niños, asistencia, justificaciones, riesgo o cualquier tabla operativa.
- Consejo médico, legal, psicológico o doctrinal vinculante.
- Historial de conversaciones o entrenamiento con datos de la parroquia.
- Voz, imágenes, archivos adjuntos o funcionamiento sin conexión.
- Enlaces web para familias y notificaciones.
- Proveedores de pago o modelos alojados fuera de la capa gratuita.
