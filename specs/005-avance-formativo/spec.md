# 005 — Avance formativo

## Contexto y objetivo

La aptitud sacramental se decide con tres dimensiones: asistencia a misa, oraciones y doctrina. El programa exige 10 oraciones, una por mes de marzo a diciembre, pero hoy no hay registro sistemático de quién las aprendió; cuando evalúan, mandan a los padres la lista de niños a los que les falta alguna. Además, hay actividades obligatorias (jornadas, retiros, viacrucis, posadas, misas de precepto, Semana Santa) que se controlan sellando la cartilla.

**Objetivo:** registrar durante todo el año el avance de cada niño en oraciones y doctrina y su cumplimiento de actividades obligatorias, con poca digitación, para que la decisión de aptitud se base en datos.

## Usuarios

- **Catequista:** evalúa oraciones y doctrina de los niños de su grupo.
- **Coordinación (o quien la tenga delegada):** define el catálogo de oraciones y actividades, corrige evaluaciones y comparte la lista de pendientes.
- **Familia:** ve qué oraciones le faltan a su hijo para acompañarlo.

## Historias de usuario

- **HU-501.** Como catequista, quiero marcar qué niños ya saben una oración con un toque, para no digitar.
- **HU-502.** Como catequista, quiero registrar cómo va cada niño en doctrina a lo largo del año.
- **HU-503.** Como coordinador, quiero saber qué niños cumplieron cada actividad obligatoria sin registrarlo dos veces.
- **HU-504.** Como coordinador, quiero compartir con los padres de un grupo la lista de oraciones pendientes, como hago hoy.
- **HU-505.** Como apoderado, quiero ver qué oraciones le faltan a mi hijo.

## Requisitos funcionales

### RF-501 Catálogo de oraciones
- El sistema deberá permitir a la coordinación definir las 10 oraciones del ciclo con su orden y el mes sugerido para cada una.
- El sistema deberá tratar el mes sugerido solo como guía: una oración nunca se considera atrasada.

### RF-502 Evaluación de oraciones
- Cuando un catequista evalúa una oración, el sistema deberá registrar por niño "sabe" o "aún no", con la fecha y el evaluador.
- El sistema deberá permitir marcar una oración en cualquier momento del ciclo, antes o después de su mes sugerido.
- El sistema deberá permitir volver a "aún no" una oración marcada como "sabe" y conservar el historial de evaluaciones.
- El sistema deberá mostrar en el perfil del niño cuántas de las 10 oraciones sabe y cuáles le faltan.
- El sistema deberá permitir evaluar una oración para todo un grupo en una sola lista, con un toque por niño.

### RF-503 Doctrina
- El sistema deberá registrar por niño la evaluación de doctrina con el método y la escala que se definan. **[NECESITA ACLARACIÓN]**
- El sistema deberá mostrar en el perfil del niño su situación en doctrina a lo largo del ciclo.

### RF-504 Actividades obligatorias
- El sistema deberá permitir a la coordinación crear actividades obligatorias con nombre, tipo (jornada, retiro, viacrucis, posada, misa de precepto o Semana Santa) y fecha.
- El sistema deberá considerar cumplida una actividad cuando el niño tiene registrada su asistencia (spec 003, RF-313); quien registró la asistencia es la constancia.
- El sistema deberá mostrar en el perfil del niño las actividades cumplidas y las no cumplidas del ciclo.
- Donde la actividad sea una jornada, el sistema deberá contar la inasistencia no justificada como una falta (spec 003, RF-311).

### RF-505 Oraciones pendientes
- El sistema deberá mostrar a cada apoderado, en su enlace personal, las oraciones que le faltan a su hijo.
- Cuando la coordinación lo solicita, el sistema deberá generar por grupo una lista para compartir con nombre del niño y oraciones que le faltan.
- El sistema deberá registrar quién generó cada lista y cuándo.

### RF-506 Quién evalúa y corrige
- El sistema deberá permitir evaluar oraciones y doctrina a los catequistas del grupo y, durante ese domingo, al catequista que pasó la lista de catequesis del grupo (spec 003, RF-306).
- Mientras no termine el domingo, el sistema deberá permitir a quien hizo una evaluación corregirla, conservando el valor anterior.
- Cuando termina el domingo, el sistema deberá permitir corregir una evaluación solo a la coordinación, exigiendo un motivo y conservando el valor anterior, quién lo cambió y cuándo.

## Requisitos no funcionales

- **RNF-501 Evaluación por lista.** Evaluar una oración para todo un grupo deberá hacerse en una sola lista con un toque por niño (R27).
- **RNF-502 Sin conexión.** Las evaluaciones de oraciones y doctrina deberán poder registrarse sin señal y sincronizarse después (R19).
- **RNF-503 Un solo registro.** La asistencia a actividades se registra una sola vez y se reutiliza como cumplimiento.

## Casos límite

- Niño ausente el domingo en que se evaluó una oración: se le evalúa otro día, sin atraso.
- Niño que aprende una oración antes de su mes sugerido: se marca "sabe" igual.
- Niño que olvida una oración que sabía: vuelve a "aún no" y queda el historial.
- Niño inscrito tarde: tiene las mismas 10 oraciones, sin atrasos.
- Catequista que reemplaza a otro un domingo: evalúa ese grupo solo ese día.
- Niño que cambia de grupo con oraciones pendientes: las pendientes lo siguen al nuevo grupo.
- Niño retirado: sus evaluaciones se conservan y no se pueden modificar.
- Actividad cancelada o reprogramada.

## Fuera de alcance

- Contenidos de las sesiones, fichas o material del libro de temas.
- Planificación semanal de las sesiones de los catequistas.
- Evaluaciones en línea que respondan los propios niños.
- Una firma de actividad distinta de la asistencia registrada.

## Criterios de finalización

- Un catequista registra una oración para todo su grupo en una sola lista, también sin señal.
- El perfil de un niño muestra cuántas de las 10 oraciones sabe, su situación en doctrina y sus actividades cumplidas.
- Una oración puede marcarse antes de su mes, y ninguna aparece como atrasada.
- La asistencia a una actividad aparece como cumplida sin volver a registrarla.
- Cada apoderado ve en su enlace solo las oraciones pendientes de su hijo.
- La lista por grupo coincide con las evaluaciones registradas y queda constancia de quién la generó.
- La inasistencia no justificada a una jornada suma una falta.

## Dudas abiertas

- **[NECESITA ACLARACIÓN]** ¿Cómo se evalúa la doctrina (por tema semanal, evaluaciones periódicas o una evaluación final) y con qué escala? Pendiente de consultar con el coordinador.
- **[NECESITA ACLARACIÓN]** ¿Cuáles son las 10 oraciones y su orden?
- **[NECESITA ACLARACIÓN]** Si dos catequistas evalúan distinto la misma oración del mismo niño, ¿cuál prevalece?
- **[NECESITA ACLARACIÓN]** ¿Las actividades de varios días (Semana Santa, posadas) son una actividad o varias? ¿Cuántos días hay que asistir para cumplirla?
- **[NECESITA ACLARACIÓN]** ¿Solo las jornadas suman falta, o también retiros y misas de precepto?
- **[NECESITA ACLARACIÓN]** La lista por grupo expone el avance de cada niño a todos los padres del grupo y, una vez compartida, queda fuera del control de acceso y de la retención (spec 001). ¿Lo acepta la coordinación de forma consciente?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R10 Oraciones | RF-501, RF-502, RF-505, RF-506 |
| R11 Doctrina | RF-503, RF-506 |
| R12 Actividades obligatorias | RF-504 |
