# Perfil e inscripción del catequizando

## Purpose

Un perfil único por niño que reúna sus datos, el estado de sus documentos de inscripción, sus condiciones a considerar y, a medida que avancen las demás capacidades, su asistencia, justificaciones y avance formativo; y que la coordinación pueda formar grupos teniendo en cuenta esas condiciones. La coordinación, o quien la tenga delegada, es quien inscribe, corrige, revisa documentos y forma grupos. El catequista consulta el perfil y las condiciones de los niños de su grupo. La familia consulta el perfil de su hijo y qué documentos le faltan.

## Requirements

### Requirement: RF-201 Mantener un único perfil

El sistema SHALL mantener un único perfil por niño, que perdure entre ciclos mientras no se aplique la retención (spec 001, RF-108).

#### Scenario: Perfil entre ciclos

- **WHEN** un niño pasa de un ciclo a otro y aún no se aplicó la retención
- **THEN** el sistema conserva su único perfil

#### Scenario: Niño que se reinscribe tras abandonar

- **WHEN** un niño que abandonó un ciclo anterior se reinscribe y su perfil no fue anonimizado
- **THEN** el sistema reutiliza su perfil

### Requirement: RF-201 Mostrar el perfil

Cuando se abre el perfil de un niño, el sistema SHALL mostrar nombre, edad, grupo, apoderados, estado de documentos y un resumen de asistencia, justificaciones y avance formativo del ciclo actual.

#### Scenario: HU-205 Ver el año en un solo lugar

- **WHEN** un catequista abre el perfil de un niño de su grupo
- **THEN** el sistema muestra nombre, edad, grupo, apoderados, estado de documentos y el resumen de asistencia, justificaciones y avance del ciclo actual

### Requirement: RF-201 Avisar un posible duplicado

Si al inscribir se detecta que el niño podría estar ya registrado, el sistema SHALL avisarlo a la coordinación sin mostrar datos del perfil existente hasta que ella lo confirme.

#### Scenario: Posible duplicado

- **WHEN** al inscribir el sistema detecta que el niño podría estar ya registrado
- **THEN** avisa a la coordinación sin mostrar datos del perfil existente hasta que ella lo confirme

### Requirement: RF-202 Inscribir y editar solo la coordinación

El sistema SHALL permitir inscribir y editar niños solo a la coordinación o a quien la tenga delegada.

#### Scenario: Quién inscribe

- **WHEN** la coordinación o su delegado inscribe o edita a un niño
- **THEN** el sistema acepta el registro
- **WHEN** un catequista o un apoderado intenta inscribir a un niño
- **THEN** el sistema no lo permite

### Requirement: RF-202 Impedir la inscripción sin conexión

Mientras no haya conexión, el sistema SHALL NOT permitir inscribir ni editar los datos de inscripción, y SHALL indicarlo con claridad.

#### Scenario: Inscripción en el local sin señal

- **WHEN** no hay conexión y se intenta inscribir o editar los datos de inscripción
- **THEN** el sistema lo impide y lo explica con claridad

### Requirement: RF-202 Registrar los datos del niño

El sistema SHALL registrar de cada niño: nombres, apellidos, fecha de nacimiento, sexo, si está bautizado y al menos un apoderado con un medio de contacto.

#### Scenario: HU-201 Inscribir lo indispensable

- **WHEN** la coordinación inscribe a un niño
- **THEN** el sistema registra nombres, apellidos, fecha de nacimiento, sexo, si está bautizado y al menos un apoderado con un medio de contacto

### Requirement: RF-202 Exigir el consentimiento informado

El sistema SHALL NOT completar la inscripción sin el consentimiento informado del apoderado (spec 001, RF-106).

#### Scenario: Inscripción sin consentimiento

- **WHEN** se intenta completar la inscripción sin el consentimiento informado del apoderado
- **THEN** el sistema no la completa

### Requirement: RF-202 Advertir edad fuera de rango

Si la edad del niño a la fecha de inicio del ciclo está fuera del rango de 8 a 13 años, el sistema SHALL advertirlo y pedir confirmación de la coordinación para continuar.

#### Scenario: Edad fuera de 8 a 13

- **WHEN** a la fecha de inicio del ciclo el niño no tiene entre 8 y 13 años
- **THEN** el sistema advierte y pide confirmación de la coordinación para continuar

#### Scenario: Edad a la fecha de inicio del ciclo

- **WHEN** el niño cumple años entre el inicio del ciclo y su inscripción
- **THEN** el sistema calcula la edad a la fecha de inicio del ciclo

#### Scenario: Cumple 14 durante el ciclo

- **WHEN** un niño de 13 años cumple 14 durante el ciclo
- **THEN** permanece en su grupo

### Requirement: RF-203 Conservar el valor anterior

Cuando la coordinación corrige un dato de inscripción, el sistema SHALL conservar el valor anterior, quién lo cambió y cuándo.

#### Scenario: Corrección de un dato

- **WHEN** la coordinación corrige un dato de inscripción
- **THEN** el sistema conserva el valor anterior, quién lo cambió y cuándo

### Requirement: RF-203 Avisar si cambia el grupo sugerido

Si la corrección de la fecha de nacimiento cambia el grupo sugerido, el sistema SHALL avisarlo sin mover al niño de grupo automáticamente.

#### Scenario: Nueva fecha de nacimiento

- **WHEN** la corrección de la fecha de nacimiento cambia el grupo sugerido
- **THEN** el sistema avisa y no mueve al niño de grupo automáticamente

### Requirement: RF-203 Anular una inscripción

Cuando la coordinación anula una inscripción hecha por error, el sistema SHALL retirar al niño de su grupo y de las listas sin borrar los registros ya hechos.

#### Scenario: Inscripción anulada

- **WHEN** la coordinación anula una inscripción hecha por error
- **THEN** el sistema retira al niño de su grupo y de las listas y conserva los registros ya hechos

#### Scenario: Niño anulado que luego sí se inscribe

- **WHEN** un niño cuya inscripción fue anulada se inscribe de nuevo
- **THEN** el sistema permite la nueva inscripción sin haber borrado los registros anteriores

### Requirement: RF-204 Llevar el estado de cada documento

El sistema SHALL llevar, por niño y ciclo, el estado de cada documento: documento de identidad, partida de nacimiento, partida de bautismo, boleta de pago y ficha de compromiso firmada.

#### Scenario: HU-202 Documentos que faltan

- **WHEN** la coordinación consulta los documentos de un niño en el ciclo
- **THEN** el sistema muestra el estado del documento de identidad, la partida de nacimiento, la partida de bautismo, la boleta de pago y la ficha de compromiso firmada

#### Scenario: Documento entregado después de iniciado el ciclo

- **WHEN** un documento se entrega después de iniciado el ciclo
- **THEN** el sistema actualiza el estado de ese documento en el ciclo

### Requirement: RF-204 Registrar solo el estado del documento

El sistema SHALL registrar solo el estado del documento (pendiente, entregado, inválido o no aplica), la fecha y quién lo recibió; SHALL NOT guardar imágenes ni copias de los documentos.

#### Scenario: Documento sin imagen

- **WHEN** se registra un documento de inscripción
- **THEN** el sistema guarda solo el estado, la fecha y quién lo recibió, sin imágenes ni copias

### Requirement: RF-204 Partida de bautismo no aplica

Donde el niño no esté bautizado, el sistema SHALL marcar la partida de bautismo como "no aplica".

#### Scenario: Niño no bautizado

- **WHEN** el niño no está bautizado
- **THEN** el sistema marca la partida de bautismo como "no aplica"

### Requirement: RF-204 Bautismo durante el ciclo

Cuando un niño se bautiza durante el ciclo, el sistema SHALL permitir pasar la partida de bautismo de "no aplica" a "pendiente".

#### Scenario: Se bautiza durante el ciclo

- **WHEN** un niño no bautizado se bautiza durante el ciclo
- **THEN** el sistema permite pasar la partida de bautismo de "no aplica" a "pendiente"

### Requirement: RF-204 Marcar un documento inválido

Cuando un documento entregado resulta ilegible o inválido, el sistema SHALL permitir marcarlo como inválido con un motivo y volverlo a contar como pendiente.

#### Scenario: Documento ilegible

- **WHEN** un documento entregado resulta ilegible o inválido
- **THEN** el sistema permite marcarlo como inválido con un motivo y volverlo a contar como pendiente

### Requirement: RF-204 Listar documentos pendientes o inválidos

El sistema SHALL mostrar a la coordinación la lista de niños con documentos pendientes o inválidos.

#### Scenario: HU-206 Documentos pendientes

- **WHEN** la coordinación o el apoderado consultan los documentos
- **THEN** se distingue qué documentos están pendientes o inválidos

### Requirement: RF-205 Registrar condiciones por categoría

El sistema SHALL registrar las condiciones de un niño eligiendo una o más categorías de una lista cerrada: trastorno del espectro autista, déficit de atención e hiperactividad, discapacidad física, discapacidad intelectual, alergia, condición médica y otra.

#### Scenario: HU-203 Condiciones sin diagnóstico

- **WHEN** la coordinación registra las condiciones de un niño
- **THEN** elige una o más categorías de esa lista cerrada, sin guardar un diagnóstico

### Requirement: RF-205 Nota de apoyo en la sesión

El sistema SHALL permitir añadir a cada condición una nota opcional y corta sobre cómo apoyar al niño en la sesión, sin diagnósticos ni tratamientos.

#### Scenario: Nota de apoyo

- **WHEN** se añade una nota a una condición
- **THEN** el sistema acepta solo una nota opcional y corta sobre cómo apoyar al niño en la sesión, sin diagnósticos ni tratamientos

### Requirement: RF-205 Mostrar condiciones al grupo

El sistema SHALL mostrar esas condiciones solo a la coordinación (o quien la tenga delegada) y a los catequistas del grupo del niño.

#### Scenario: Condiciones del propio grupo

- **WHEN** un catequista consulta las condiciones de un niño de su grupo
- **THEN** el sistema se las muestra
- **WHEN** consulta las de un niño de otro grupo
- **THEN** el sistema no se las muestra

### Requirement: RF-206 Crear, renombrar y cerrar grupos

El sistema SHALL permitir a la coordinación crear, renombrar y cerrar los grupos que el ciclo necesite, cada uno con su rango de edad, si es mixto o por sexo, y sus catequistas.

#### Scenario: HU-204 Crear los grupos del ciclo

- **WHEN** la coordinación crea un grupo
- **THEN** el sistema registra su rango de edad, si es mixto o por sexo, y sus catequistas

#### Scenario: Segundo grupo de la misma edad

- **WHEN** un grupo de 8 años tiene más de 20 niños
- **THEN** la coordinación puede crear un segundo grupo de 8 años

### Requirement: RF-206 Sugerir grupos al asignar

Cuando la coordinación asigna un niño, el sistema SHALL sugerir los grupos que corresponden a su edad y sexo según la regla habitual (8, 9 y 10 años mixtos; 11 a 13 separados por sexo), y mostrar de cada uno cuántos niños tiene y cuántos con cada categoría de condición.

#### Scenario: Sugerencia para un niño de 8 años

- **WHEN** la coordinación asigna a un niño de 8 años y existen dos grupos de 8 años
- **THEN** el sistema sugiere ambos y muestra de cada uno cuántos niños tiene y cuántos con cada categoría de condición

### Requirement: RF-206 Asignar a un grupo distinto

El sistema SHALL permitir a la coordinación asignar al niño a un grupo distinto del sugerido.

#### Scenario: Grupo distinto del sugerido

- **WHEN** la coordinación asigna al niño a un grupo que no es el sugerido
- **THEN** el sistema acepta esa asignación

### Requirement: RF-206 Conservar el historial al cambiar de grupo

Cuando un niño cambia de grupo durante el ciclo, el sistema SHALL conservar su historial y hacerlo visible para el nuevo catequista.

#### Scenario: Cambio de grupo

- **WHEN** un niño cambia de grupo durante el ciclo
- **THEN** el sistema conserva su historial y lo muestra al nuevo catequista

### Requirement: RF-206 Avisar un grupo sin catequista

Si un grupo no tiene catequista asignado, el sistema SHALL avisarlo a la coordinación.

#### Scenario: Grupo sin catequista

- **WHEN** un grupo no tiene catequista asignado
- **THEN** el sistema avisa a la coordinación

### Requirement: RF-207 Vincular apoderados

El sistema SHALL permitir vincular uno o más apoderados a un niño, indicando su relación (madre, padre u otro familiar o tutor), y un apoderado a varios niños.

#### Scenario: Dos hermanos con el mismo apoderado

- **WHEN** dos hermanos comparten apoderado
- **THEN** el sistema vincula a ese apoderado con ambos niños

#### Scenario: Apoderado que no es padre ni madre

- **WHEN** el apoderado es una abuela, un tío u otro tutor
- **THEN** el sistema registra la relación como otro familiar o tutor

### Requirement: RF-207 Revocar el enlace al desvincular

Cuando la coordinación desvincula a un apoderado, el sistema SHALL revocar su enlace personal para ese niño (spec 001, RF-110).

#### Scenario: Desvincular a un apoderado

- **WHEN** la coordinación desvincula a un apoderado de un niño
- **THEN** el sistema revoca su enlace personal para ese niño

### Requirement: RNF-201 Mínima digitación

Registrar los datos obligatorios de un niño (sin contar la lectura del consentimiento) SHALL tomar menos de 3 minutos desde el celular (R27).

#### Scenario: Inscripción desde el celular

- **WHEN** la coordinación registra los datos obligatorios de un niño desde el celular, sin contar la lectura del consentimiento
- **THEN** esa captura toma menos de 3 minutos

### Requirement: RNF-202 Mobile-first

Todo el flujo de inscripción y consulta SHALL poder hacerse desde un celular (R18).

#### Scenario: Inscripción con conexión desde el celular

- **WHEN** la coordinación inscribe a un niño de punta a punta desde un celular con conexión
- **THEN** el sistema completa el flujo sin exigir otro dispositivo

### Requirement: RNF-203 Datos restringidos sin conexión

Las condiciones y el número de documento de identidad SHALL NOT estar disponibles sin conexión (spec 001, RNF-101).

#### Scenario: Consulta sin conexión

- **WHEN** no hay conexión
- **THEN** las condiciones y el número de documento de identidad no están disponibles

### Requirement: RNF-204 Perfil liviano sin conexión

Abrir el perfil sin conexión SHALL mostrar los datos operativos (nombre, grupo, asistencia, avance) ya sincronizados.

#### Scenario: Perfil ya sincronizado

- **WHEN** se abre el perfil sin conexión y esos datos ya están sincronizados
- **THEN** el sistema muestra nombre, grupo, asistencia y avance
