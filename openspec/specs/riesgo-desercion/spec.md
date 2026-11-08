# Riesgo de deserción

## Purpose

Avisar a tiempo, siguiendo el proceso que el equipo ya usa, qué niños están en riesgo y en qué paso están; detectar el abandono silencioso; y dejar registrado cada contacto con la familia. El retiro siempre lo decide una persona. La coordinación revisa las alertas, cita a los padres, registra fichas y confirma retiros. El catequista ve las alertas de su grupo y registra los contactos. La familia ve las faltas de su hijo.

## Requirements

### Requirement: RF-701 Contar la falta de la spec 003

El sistema SHALL contar como falta lo definido en la spec 003 (RF-311): un domingo sin misa ni catequesis, o una jornada sin asistencia.

#### Scenario: Falta que entra al conteo

- **WHEN** un niño falta a misa y a catequesis el mismo domingo, o falta a una jornada
- **THEN** el sistema toma esa ausencia como falta según RF-311

### Requirement: RF-701 Sumar solo si venció el plazo

El sistema SHALL sumar una falta al conteo de alertas solo cuando venció su plazo de justificación (spec 004, RF-405) y no tiene una justificación aprobada ni pendiente de revisión.

#### Scenario: Falta justificada dentro del plazo

- **WHEN** una falta está justificada o todavía está dentro de su plazo
- **THEN** el sistema no la suma al conteo de alertas

#### Scenario: Venció sin justificación

- **WHEN** vence el plazo de una falta y no tiene justificación aprobada ni pendiente
- **THEN** el sistema la suma al conteo de alertas

### Requirement: RF-701 Esperar la revisión pendiente

Si al vencer el plazo hay una justificación pendiente de revisión, el sistema SHALL esperar a la revisión: si se rechaza, la falta se suma; si se aprueba, no.

#### Scenario: Justificación pendiente al vencer el plazo

- **WHEN** al vencer el plazo hay una justificación pendiente de revisión
- **THEN** el sistema espera: si se rechaza, suma la falta; si se aprueba, no la suma

### Requirement: RF-701 Mostrar pendiente de justificar

Mientras una falta esté dentro de su plazo, el sistema SHALL mostrarla como "pendiente de justificar" sin sumarla.

#### Scenario: Dentro del plazo

- **WHEN** una falta sigue dentro de su plazo de justificación
- **THEN** el sistema la muestra como "pendiente de justificar" y no la suma

### Requirement: RF-702 Ubicar al niño en un paso

El sistema SHALL ubicar a cada niño activo en un paso según su conteo de faltas: sin riesgo (0 o 1), contacto (2), citación (3 sin ficha firmada), seguimiento (3 con ficha firmada), alerta de retiro (4 o más, con o sin ficha) o retirado (retiro confirmado).

#### Scenario: HU-701 Dos faltas

- **WHEN** un niño activo llega a 2 faltas contadas
- **THEN** el sistema lo ubica en contacto, para que el catequista del grupo y la coordinación contacten al apoderado

#### Scenario: HU-702 Tres faltas sin ficha

- **WHEN** un niño activo llega a 3 faltas y no tiene ficha firmada
- **THEN** el sistema lo ubica en citación, para que la coordinación cite al apoderado y firme la ficha

#### Scenario: Tres faltas con ficha

- **WHEN** un niño activo tiene 3 faltas y la ficha ya está firmada
- **THEN** el sistema lo ubica en seguimiento

#### Scenario: Cuatro faltas

- **WHEN** un niño activo llega a 4 o más faltas
- **THEN** el sistema lo ubica en alerta de retiro para que la coordinación decida

### Requirement: RF-702 Mostrar la alerta al subir de paso

Cuando un niño sube de paso, el sistema SHALL mostrar la alerta correspondiente en la lista de riesgo y en su perfil.

#### Scenario: Sube de paso

- **WHEN** el conteo de faltas hace subir de paso a un niño
- **THEN** el sistema muestra la alerta correspondiente en la lista de riesgo y en su perfil

### Requirement: RF-702 Indicar alerta de retiro sin ficha

Si un niño llega a la alerta de retiro sin ficha firmada, el sistema SHALL indicarlo en la alerta.

#### Scenario: Cuarta falta sin ficha firmada

- **WHEN** un niño llega a 4 o más faltas sin ficha firmada
- **THEN** la alerta de retiro indica "sin ficha firmada"

#### Scenario: Apoderado que se niega a firmar

- **WHEN** el apoderado se niega a firmar la ficha
- **THEN** el sistema no registra la ficha y el proceso sigue según el conteo de faltas

### Requirement: RF-702 Bajar de paso al bajar el conteo

Cuando el conteo baja (por una justificación aprobada o una corrección de asistencia), el sistema SHALL devolver al niño al paso que corresponde y cerrar las alertas que ya no aplican.

#### Scenario: Asistencia corregida a presente

- **WHEN** una justificación aprobada o una corrección de asistencia baja el conteo
- **THEN** el sistema devuelve al niño al paso que corresponde y cierra las alertas que ya no aplican

### Requirement: RF-703 Registrar la ficha de compromiso

Cuando la coordinación registra que el apoderado firmó la ficha de compromiso, el sistema SHALL guardar la fecha, el apoderado que firmó y quién la registró, sin imagen del documento.

#### Scenario: Ficha firmada

- **WHEN** la coordinación registra que el apoderado firmó la ficha de compromiso
- **THEN** el sistema guarda la fecha, el apoderado que firmó y quién la registró, sin imagen del documento

### Requirement: RF-704 No retirar de forma automática

El sistema SHALL NOT retirar a ningún niño de forma automática.

#### Scenario: Alerta de retiro

- **WHEN** un niño llega a la alerta de retiro
- **THEN** el sistema no lo retira hasta que una persona lo confirme

### Requirement: RF-704 Confirmar el retiro con motivo

Cuando la coordinación confirma un retiro, el sistema SHALL exigir un motivo, registrar quién y cuándo, y marcar al niño como inactivo.

#### Scenario: Retiro confirmado

- **WHEN** la coordinación confirma un retiro e indica el motivo
- **THEN** el sistema registra quién y cuándo, y marca al niño como inactivo
- **WHEN** intenta confirmarlo sin motivo
- **THEN** el sistema no registra el retiro

### Requirement: RF-705 Fijar los domingos de posible abandono

El sistema SHALL permitir a la coordinación fijar un número de domingos seguidos sin misa ni catequesis.

#### Scenario: Umbral de abandono

- **WHEN** la coordinación fija un número de domingos seguidos sin misa ni catequesis
- **THEN** el sistema usa ese número para detectar un posible abandono

### Requirement: RF-705 Marcar posible abandono

Cuando un niño alcanza ese número y el último contacto registrado tiene el resultado "no responde" o no hay contacto, el sistema SHALL marcarlo como "posible abandono" para que la coordinación confirme o descarte el retiro.

#### Scenario: HU-703 Dejó de venir sin avisar

- **WHEN** un niño alcanza los domingos seguidos fijados sin misa ni catequesis y el último contacto es "no responde" o no hay contacto
- **THEN** el sistema lo marca como "posible abandono" para que la coordinación confirme o descarte el retiro

### Requirement: RF-706 Registrar cada contacto

El sistema SHALL permitir registrar cada contacto con el apoderado: fecha, apoderado contactado, quién contactó y un resultado de una lista cerrada (no responde, se compromete a volver, justificará, se retira, otro).

#### Scenario: HU-704 Registrar la conversación

- **WHEN** un catequista registra que habló con el padre
- **THEN** el sistema guarda la fecha, el apoderado contactado, quién contactó y el resultado

#### Scenario: Contacto con uno de dos apoderados

- **WHEN** el niño tiene dos apoderados y se contacta a uno
- **THEN** el sistema registra a cuál se contactó

### Requirement: RF-706 Nota sin datos sensibles

El sistema SHALL permitir añadir una nota corta opcional, sin datos de salud ni situaciones familiares.

#### Scenario: Nota del contacto

- **WHEN** se añade una nota al contacto
- **THEN** el sistema acepta solo una nota corta y opcional, sin datos de salud ni situaciones familiares

### Requirement: RF-706 Cerrar la alerta de contacto

Cuando se registra un contacto sobre un niño en el paso "contacto", el sistema SHALL cerrar esa alerta.

#### Scenario: Contacto en el paso contacto

- **WHEN** se registra un contacto de un niño que está en el paso contacto
- **THEN** el sistema cierra esa alerta

### Requirement: RF-707 Lista de riesgo de la coordinación

El sistema SHALL mostrar a la coordinación la lista de niños en riesgo ordenada por paso, con las faltas que originaron cada alerta.

#### Scenario: Lista de la coordinación

- **WHEN** la coordinación abre la lista de riesgo
- **THEN** el sistema muestra a los niños en riesgo ordenados por paso, con las faltas que originaron cada alerta

### Requirement: RF-707 Lista de riesgo del catequista

El sistema SHALL mostrar a cada catequista la lista de riesgo de sus grupos.

#### Scenario: Lista del grupo

- **WHEN** un catequista abre la lista de riesgo
- **THEN** el sistema muestra la de sus grupos

#### Scenario: Cambio de grupo con alertas abiertas

- **WHEN** un niño cambia de grupo y tiene alertas abiertas
- **THEN** las alertas lo siguen al nuevo grupo

### Requirement: RF-708 Cargar faltas y ficha desde papel

Donde el sistema empiece a usarse con el ciclo avanzado, el sistema SHALL permitir a la coordinación cargar por niño las faltas no justificadas acumuladas y si ya firmó la ficha de compromiso.

#### Scenario: HU-705 Cargar lo llevado en papel

- **WHEN** el sistema empieza a usarse con el ciclo avanzado
- **THEN** la coordinación puede cargar por niño las faltas no justificadas acumuladas y si ya firmó la ficha

### Requirement: RF-708 Marcar el saldo y ubicar el paso

El sistema SHALL marcar ese saldo como "cargado desde papel", con quién lo cargó y cuándo, y ubicar al niño en el paso que le corresponde.

#### Scenario: Ciclo empezado en papel

- **WHEN** la coordinación carga un saldo desde papel
- **THEN** el sistema lo marca como "cargado desde papel", registra quién lo cargó y cuándo, y ubica al niño en el paso que corresponde a ese saldo

### Requirement: RNF-701 Alerta oportuna

Las alertas SHALL aparecer en cuanto vence el plazo de justificación de una falta y los registros del domingo están sincronizados, sin pasos manuales.

#### Scenario: Plazo vencido y domingo sincronizado

- **WHEN** vence el plazo de justificación de una falta y los registros de ese domingo ya están sincronizados
- **THEN** la alerta aparece sin pasos manuales

### Requirement: RNF-702 Reglas explicables

Cada alerta SHALL indicar qué faltas la originaron.

#### Scenario: Origen de la alerta

- **WHEN** el sistema muestra una alerta
- **THEN** indica qué faltas la originaron

### Requirement: RNF-703 Fuera del camino crítico

Calcular el riesgo SHALL NOT hacer más lenta la toma de asistencia.

#### Scenario: Toma de asistencia

- **WHEN** un catequista registra la asistencia
- **THEN** el cálculo del riesgo no hace más lenta esa toma

### Requirement: RNF-704 Sin alertas falsas sin conexión

Las alertas SHALL calcularse con los registros ya sincronizados de todos los catequistas, no con los datos parciales de un solo celular.

#### Scenario: Datos de un solo celular

- **WHEN** un celular tiene registros que los demás catequistas aún no sincronizan
- **THEN** el sistema no calcula la alerta con esos datos parciales

### Requirement: RNF-705 Costo cero

Las alertas se muestran dentro del sistema y SHALL NOT enviar mensajes con costo (R23).

#### Scenario: Aviso de una alerta

- **WHEN** aparece una alerta
- **THEN** el sistema la muestra dentro de la aplicación y no envía un mensaje con costo
