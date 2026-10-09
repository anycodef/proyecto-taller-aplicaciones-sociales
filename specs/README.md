# Specs de SIGECAT

Cada carpeta describe una funcionalidad: el QUÉ y el POR QUÉ en `spec.md`, y el CÓMO (modelo de datos, API, cliente, decisiones técnicas y tests) en `plan.md`.

| Spec | Funcionalidad | Plan | Requerimientos de origen |
| --- | --- | --- | --- |
| [001](001-acceso-y-roles/spec.md) | Acceso, roles y protección de datos | [plan](001-acceso-y-roles/plan.md) | R15, R16, R21, R25, R26 |
| [002](002-perfil-catequizando/spec.md) | Perfil e inscripción del catequizando | [plan](002-perfil-catequizando/plan.md) | R1, R2, R3 |
| [003](003-asistencia-dominical/spec.md) | Asistencia dominical | [plan](003-asistencia-dominical/plan.md) | R4, R5, R6 |
| [004](004-justificaciones/spec.md) | Justificaciones de ausencias | [plan](004-justificaciones/plan.md) | R7, R8, R9 |
| [005](005-avance-formativo/spec.md) | Avance formativo | [plan](005-avance-formativo/plan.md) | R10, R11, R12 |
| [006](006-aptitud-sacramental/spec.md) | Aptitud sacramental | [plan](006-aptitud-sacramental/plan.md) | R13 |
| [007](007-riesgo-desercion/spec.md) | Riesgo de deserción | [plan](007-riesgo-desercion/plan.md) | R14 |
| [008](008-historial-ciclos/spec.md) | Historial de ciclos | [plan](008-historial-ciclos/plan.md) | R17 |

Los requerimientos transversales (R18 a R24 y R27) no tienen spec propia: aparecen como requisitos no funcionales en cada spec que los necesita.

## Convenciones

- **Identificadores.** La centena del requisito indica la spec: `RF-301` es el primer requisito funcional de la spec 003, `RNF-301` su primer requisito no funcional. Cada test cita el identificador que verifica.
- **Criterios de aceptación en EARS:**
  - Ubicuo: «El sistema deberá…»
  - Por evento: «Cuando <disparador>, el sistema deberá…»
  - Por estado: «Mientras <estado>, el sistema deberá…»
  - No deseado: «Si <condición>, entonces el sistema deberá…»
  - Opcional: «Donde <característica>, el sistema deberá…»
- **Dudas.** Lo que el trabajo de campo no confirmó se marca **[NECESITA ACLARACIÓN]** y no se implementa hasta resolverse.

## Requerimientos de origen

| Id | Requerimiento |
| --- | --- |
| R1 | Perfil único por catequizando (8 a 13 años) que consolide toda su información |
| R2 | Datos y documentos de inscripción (DNI, partida de nacimiento, partida de bautismo si aplica, boleta de pago y ficha de compromiso) |
| R3 | Condiciones de salud, neurodivergencia y necesidades especiales para formar grupos |
| R4 | Asistencia dominical a misa y a la sesión de catequesis |
| R5 | Registro de asistencia a misa confiable y verificable como evidencia ante el párroco |
| R6 | Tomar asistencia en menos tiempo que en papel |
| R7 | Gestionar justificaciones fuera del WhatsApp personal de la coordinación |
| R8 | Evidencias de justificación guardadas de forma inequívoca en el perfil del niño |
| R9 | Padres justifican mediante un mecanismo sencillo |
| R10 | Seguimiento de la memorización de las 10 oraciones (una por mes) |
| R11 | Evaluación y avance continuo en doctrina |
| R12 | Cumplimiento y firma de actividades obligatorias |
| R13 | Trazabilidad anual de misa, oraciones y doctrina para la aptitud sacramental |
| R14 | Detección temprana de niños en riesgo de deserción |
| R15 | Cualquier catequista consulta el estado del niño sin depender de la coordinación |
| R16 | Continuidad del equipo dominical en ausencia de la coordinación |
| R17 | Historial institucional de ciclos anteriores |
| R18 | Mobile-first |
| R19 | Offline-first con sincronización diferida |
| R20 | Consumo mínimo de datos móviles |
| R21 | Alojado en la nube con usuarios autenticados |
| R22 | Soportar picos de uso los domingos por la mañana |
| R23 | Costo de operación cero |
| R24 | Administración de infraestructura nula o mínima |
| R25 | Anonimizar la identidad de catequistas menores de edad |
| R26 | Protección de datos de menores: roles, minimización, retención y consentimiento |
| R27 | Minimizar el tiempo de digitación |
