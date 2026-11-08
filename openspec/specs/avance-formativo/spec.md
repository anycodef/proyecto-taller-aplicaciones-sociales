# Avance formativo

## Purpose

Registrar durante todo el año el avance de cada niño en oraciones y doctrina y su cumplimiento de actividades obligatorias, con poca digitación, para que la decisión de aptitud se base en datos. El catequista evalúa oraciones y doctrina de su grupo. La coordinación define el catálogo, corrige evaluaciones y comparte la lista de pendientes. La familia ve qué oraciones le faltan a su hijo.

## Requirements

### Requirement: RF-501 Definir las 10 oraciones

El sistema SHALL permitir a la coordinación definir las 10 oraciones del ciclo con su orden y el mes sugerido para cada una.

#### Scenario: Catálogo del ciclo

- **WHEN** la coordinación define las 10 oraciones del ciclo
- **THEN** el sistema guarda el orden y el mes sugerido de cada una

### Requirement: RF-501 Mes sugerido solo como guía

El sistema SHALL tratar el mes sugerido solo como guía: una oración nunca se considera atrasada.

#### Scenario: Ninguna oración atrasada

- **WHEN** el sistema muestra el avance de oraciones
- **THEN** trata el mes sugerido solo como guía y no marca ninguna oración como atrasada

### Requirement: RF-502 Registrar sabe o aún no

Cuando un catequista evalúa una oración, el sistema SHALL registrar por niño "sabe" o "aún no", con la fecha y el evaluador.

#### Scenario: HU-502 Evaluación de una oración

- **WHEN** un catequista evalúa una oración de un niño
- **THEN** el sistema registra "sabe" o "aún no", con la fecha y el evaluador

#### Scenario: Ausente el domingo de la evaluación

- **WHEN** un niño falta el domingo en que se evaluó una oración
- **THEN** se le evalúa otro día y el sistema no lo marca como atrasado

### Requirement: RF-502 Evaluar en cualquier momento

El sistema SHALL permitir marcar una oración en cualquier momento del ciclo, antes o después de su mes sugerido.

#### Scenario: Antes del mes sugerido

- **WHEN** un niño aprende una oración antes de su mes sugerido
- **THEN** el sistema permite marcarla "sabe" igual

#### Scenario: Niño inscrito tarde

- **WHEN** un niño se inscribe tarde
- **THEN** tiene las mismas 10 oraciones y ninguna se considera atrasada

### Requirement: RF-502 Volver a aún no y conservar el historial

El sistema SHALL permitir volver a "aún no" una oración marcada como "sabe" y conservar el historial de evaluaciones.

#### Scenario: Olvida una oración que sabía

- **WHEN** una oración marcada como "sabe" vuelve a "aún no"
- **THEN** el sistema guarda el cambio y conserva el historial de evaluaciones

### Requirement: RF-502 Mostrar cuántas sabe y cuáles faltan

El sistema SHALL mostrar en el perfil del niño cuántas de las 10 oraciones sabe y cuáles le faltan.

#### Scenario: Perfil del niño

- **WHEN** se abre el perfil de un niño
- **THEN** el sistema muestra cuántas de las 10 oraciones sabe y cuáles le faltan

#### Scenario: Cambio de grupo con oraciones pendientes

- **WHEN** un niño cambia de grupo y tiene oraciones pendientes
- **THEN** esas pendientes lo siguen al nuevo grupo

### Requirement: RF-502 Evaluar al grupo en una lista

El sistema SHALL permitir evaluar una oración para todo un grupo en una sola lista, con un toque por niño.

#### Scenario: HU-501 Un toque por niño

- **WHEN** un catequista evalúa una oración para todo su grupo
- **THEN** el sistema se lo permite en una sola lista, con un toque por niño

### Requirement: RF-503 Registrar la evaluación de doctrina

El sistema SHALL registrar por niño la evaluación de doctrina con el método y la escala que se definan.

#### Scenario: HU-502 Doctrina a lo largo del año

- **WHEN** un catequista registra la evaluación de doctrina de un niño
- **THEN** el sistema la guarda con el método y la escala definidos

### Requirement: RF-503 Mostrar la situación en doctrina

El sistema SHALL mostrar en el perfil del niño su situación en doctrina a lo largo del ciclo.

#### Scenario: Situación en doctrina

- **WHEN** se abre el perfil de un niño
- **THEN** el sistema muestra su situación en doctrina a lo largo del ciclo

### Requirement: RF-504 Crear actividades obligatorias

El sistema SHALL permitir a la coordinación crear actividades obligatorias con nombre, tipo (jornada, retiro, viacrucis, posada, misa de precepto o Semana Santa) y fecha.

#### Scenario: Nueva actividad

- **WHEN** la coordinación crea una actividad obligatoria
- **THEN** el sistema guarda su nombre, su tipo y su fecha

#### Scenario: Actividad cancelada o reprogramada

- **WHEN** la coordinación cancela o reprograma una actividad obligatoria
- **THEN** el sistema conserva la actividad con esa situación y el cumplimiento sigue la asistencia registrada

### Requirement: RF-504 Cumplida por la asistencia

El sistema SHALL considerar cumplida una actividad cuando el niño tiene registrada su asistencia (spec 003, RF-313); quien registró la asistencia es la constancia.

#### Scenario: HU-503 Sin registrarla dos veces

- **WHEN** un niño tiene registrada la asistencia a una actividad obligatoria
- **THEN** el sistema la considera cumplida y quien registró la asistencia es la constancia

### Requirement: RF-504 Mostrar cumplidas y no cumplidas

El sistema SHALL mostrar en el perfil del niño las actividades cumplidas y las no cumplidas del ciclo.

#### Scenario: Actividades en el perfil

- **WHEN** se abre el perfil de un niño
- **THEN** el sistema muestra las actividades cumplidas y las no cumplidas del ciclo

### Requirement: RF-504 Falta por jornada

Donde la actividad sea una jornada, el sistema SHALL contar la inasistencia no justificada como una falta (spec 003, RF-311).

#### Scenario: Jornada no justificada

- **WHEN** un niño no asiste a una jornada y esa inasistencia no está justificada
- **THEN** el sistema cuenta una falta

### Requirement: RF-505 Mostrar pendientes al apoderado

El sistema SHALL mostrar a cada apoderado, en su enlace personal, las oraciones que le faltan a su hijo.

#### Scenario: HU-505 Oraciones que le faltan

- **WHEN** un apoderado abre su enlace personal
- **THEN** el sistema muestra solo las oraciones que le faltan a su hijo

### Requirement: RF-505 Lista del grupo para compartir

Cuando la coordinación lo solicita, el sistema SHALL generar por grupo una lista para compartir con nombre del niño y oraciones que le faltan.

#### Scenario: HU-504 Lista para los padres del grupo

- **WHEN** la coordinación solicita la lista de un grupo
- **THEN** el sistema genera una lista con el nombre de cada niño y las oraciones que le faltan, y esa lista coincide con las evaluaciones registradas

### Requirement: RF-505 Registrar quién generó la lista

El sistema SHALL registrar quién generó cada lista y cuándo.

#### Scenario: Constancia de la lista

- **WHEN** se genera una lista de oraciones pendientes
- **THEN** el sistema registra quién la generó y cuándo

### Requirement: RF-506 Quién puede evaluar

El sistema SHALL permitir evaluar oraciones y doctrina a los catequistas del grupo y, durante ese domingo, al catequista que pasó la lista de catequesis del grupo (spec 003, RF-306).

#### Scenario: Catequista que reemplaza a otro

- **WHEN** un catequista pasa la lista de catequesis de un grupo que no es el suyo
- **THEN** puede evaluar oraciones y doctrina de ese grupo solo ese domingo

### Requirement: RF-506 Corregir antes de que termine el domingo

Mientras no termine el domingo, el sistema SHALL permitir a quien hizo una evaluación corregirla, conservando el valor anterior.

#### Scenario: Corrección del mismo día

- **WHEN** quien hizo una evaluación la corrige antes de que termine el domingo
- **THEN** el sistema acepta la corrección y conserva el valor anterior

### Requirement: RF-506 Corregir después la coordinación

Cuando termina el domingo, el sistema SHALL permitir corregir una evaluación solo a la coordinación, exigiendo un motivo y conservando el valor anterior, quién lo cambió y cuándo.

#### Scenario: Corrección después del domingo

- **WHEN** termina el domingo y la coordinación corrige una evaluación con un motivo
- **THEN** el sistema guarda la corrección, el valor anterior, quién la hizo y cuándo

#### Scenario: Niño retirado

- **WHEN** un niño se retira
- **THEN** sus evaluaciones se conservan y no se pueden modificar

### Requirement: RNF-501 Evaluación por lista

Evaluar una oración para todo un grupo SHALL hacerse en una sola lista con un toque por niño (R27).

#### Scenario: Lista de todo el grupo

- **WHEN** se evalúa una oración para todo un grupo
- **THEN** se hace en una sola lista con un toque por niño

### Requirement: RNF-502 Sin conexión

Las evaluaciones de oraciones y doctrina SHALL poder registrarse sin señal y sincronizarse después (R19).

#### Scenario: Evaluación sin señal

- **WHEN** un catequista registra oraciones o doctrina sin señal
- **THEN** el sistema guarda la evaluación y la sincroniza después

### Requirement: RNF-503 Un solo registro

La asistencia a actividades se registra una sola vez y se reutiliza como cumplimiento. El sistema SHALL NOT pedir un segundo registro para dar por cumplida una actividad.

#### Scenario: Asistencia reutilizada

- **WHEN** la asistencia a una actividad ya está registrada
- **THEN** el sistema la reutiliza como cumplimiento y no pide registrarla otra vez
