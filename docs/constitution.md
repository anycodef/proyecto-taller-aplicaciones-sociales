# Constitución de SIGECAT

1. **Stack mínimo.** App en React Native + Expo con TypeScript estricto; backend serverless en Azure (Functions detrás de API Management) con PostgreSQL y Blob Storage, en capas gratuitas o crédito educativo. Ninguna dependencia nueva sin justificarla antes en la spec.
2. **La spec manda.** Todo comportamiento nace en `specs/`; si código y spec divergen se corrige primero la spec, y cada requisito tiene al menos un test que cita su identificador.
3. **Lógica sin interfaz.** Las reglas de negocio viven en `src/lib/` como TypeScript puro, sin importar React, React Native ni Expo; las pantallas solo presentan y delegan.
4. **Tests en verde.** Ninguna tarea termina con un test en rojo, omitido o eliminado para pasar; tests, typecheck y lint deben pasar antes de cada commit.
5. **Offline primero.** Las escrituras operativas van primero al almacén local y se sincronizan después; registrar asistencia nunca requiere red. Excepción administrativa aprobada el 2026-10-11: inscripción y correcciones administrativas, cuentas, roles, enlaces, delegaciones, consentimiento y condiciones se procesan exclusivamente en línea, con borradores solo en memoria; nunca se persisten ni encolan en el dispositivo. Los datos restringidos mantienen la prohibición del principio 7. Véase el ADR 013.
6. **Persistencia segura.** Cada registro nace con un UUID generado en el dispositivo; el esquema cambia solo por migraciones versionadas y una migración aplicada nunca se edita.
7. **Datos de menores.** Salud, neurodivergencia y documentos de identidad nunca se guardan en el dispositivo; el acceso por rol se impone en el servidor en cada petición, no solo en la interfaz.
8. **Idioma.** Código, identificadores y nombres de archivo en español; textos de interfaz, mensajes al usuario y documentación en español.
9. **Autoría trazable.** Todo cambio hecho por un agente de IA lleva su registro Agent Trace en el mismo commit, enlazado a la tarea de la spec que lo origina.
10. **Contexto curado.** El agente (OpenCode) trabaja solo con `AGENTS.md`, esta constitución y la spec activa; lo que se repite en un prompt se escribe en esos archivos.
11. **Skills como paquete.** Los flujos repetidos (nueva spec, migración, verificación) son Agent Skills (`SKILL.md`) versionadas en el repo y distribuidas por el plugin marketplace del proyecto.

Esta constitución prevalece sobre specs y código; modificarla requiere aprobación explícita del equipo.
