# Aptitud sacramental

## Purpose

Mostrar durante todo el año, por niño, el estado de la misa, las oraciones y la doctrina; proponer la aptitud con una regla completa y explicable; y dejar registrada la decisión final de la coordinación con su justificación. La coordinación fija los umbrales y decide, el catequista consulta a los niños de su grupo, la supervisión consulta las decisiones con su propia cuenta y la familia ve cómo va su hijo en las tres dimensiones. Al cierre del ciclo, la lista de niños aptos respalda la presentación a la Madre Concepción, al párroco y a secretaría.

## Requirements

### Requirement: RF-601 Fijar umbrales del ciclo

El sistema SHALL permitir a la coordinación fijar al inicio del ciclo el máximo de ausencias a misa no justificadas, el mínimo de oraciones sabidas de las 10 y el criterio de doctrina.

#### Scenario: Umbrales al inicio del ciclo

- **WHEN** la coordinación fija al inicio del ciclo el máximo de ausencias a misa no justificadas, el mínimo de oraciones sabidas de las 10 y el criterio de doctrina
- **THEN** el sistema conserva esos umbrales para calcular las dimensiones y la aptitud

### Requirement: RF-601 Registrar el cambio de un umbral

El sistema SHALL registrar el cambio y recalcular todas las propuestas cuando la coordinación cambia un umbral durante el ciclo.

#### Scenario: Cambio de umbrales a mitad del ciclo

- **WHEN** la coordinación cambia un umbral a mitad del ciclo
- **THEN** el sistema registra el cambio, recalcula todas las propuestas y avisa de las decisiones afectadas

### Requirement: RF-601 Mostrar dimensiones sin proponer aptitud

El sistema SHALL mostrar las dimensiones sin proponer aptitud mientras falte algún umbral.

#### Scenario: Falta algún umbral

- **WHEN** falta el máximo de ausencias a misa, el mínimo de oraciones o el criterio de doctrina
- **THEN** el sistema muestra las dimensiones de cada niño y no propone aptitud

### Requirement: RF-602 Cumplir misa

El sistema SHALL considerar que un niño cumple misa cuando sus ausencias a misa no justificadas del ciclo no superan el máximo fijado. Las ausencias justificadas aprobadas (spec 004, RF-409) y los domingos sin misa (spec 003, RF-301) no cuentan.

#### Scenario: Ausencias dentro del máximo

- **WHEN** las ausencias a misa no justificadas de un niño en el ciclo no superan el máximo fijado
- **THEN** el sistema considera que el niño cumple misa

#### Scenario: Ausencias justificadas

- **WHEN** un niño tiene ausencias a misa justificadas y aprobadas
- **THEN** esas ausencias no cuentan contra el máximo

#### Scenario: Domingo sin misa

- **WHEN** un domingo del ciclo no tiene misa
- **THEN** ese domingo no cuenta como ausencia a misa

#### Scenario: Inscrito a mitad del ciclo

- **WHEN** un niño se inscribe a mitad del ciclo
- **THEN** solo cuentan las misas desde su inscripción

#### Scenario: Misa en otro horario

- **WHEN** un niño asiste a misa en otro horario
- **THEN** el sistema lo cuenta como ausente, salvo que tenga justificación

### Requirement: RF-602 Cumplir oraciones

El sistema SHALL considerar que un niño cumple oraciones cuando sabe al menos el mínimo de oraciones fijado (spec 005, RF-502).

#### Scenario: Oraciones al mínimo fijado

- **WHEN** un niño sabe al menos el mínimo de oraciones fijado
- **THEN** el sistema considera que cumple oraciones

### Requirement: RF-602 Cumplir doctrina

El sistema SHALL considerar que un niño cumple doctrina según el criterio fijado.

#### Scenario: Doctrina según el criterio fijado

- **WHEN** el sistema evalúa la doctrina de un niño
- **THEN** determina si la cumple según el criterio de doctrina fijado por la coordinación

### Requirement: RF-602 Mostrar el estado de cada dimensión

El sistema SHALL mostrar por niño el estado de cada dimensión con su valor: ausencias a misa no justificadas frente al máximo, oraciones sabidas frente al mínimo y la situación en doctrina.

#### Scenario: HU-601 Ver las tres dimensiones durante el año

- **WHEN** el coordinador consulta en cualquier momento del año qué niños van bien y cuáles no
- **THEN** el sistema muestra por niño las ausencias a misa no justificadas frente al máximo, las oraciones sabidas frente al mínimo y la situación en doctrina

### Requirement: RF-603 Proponer no apto sin misa

El sistema SHALL proponer "no apto" cuando el niño no cumple misa, cumpla o no las demás dimensiones.

#### Scenario: Sin misa

- **WHEN** un niño no cumple misa, aunque cumpla oraciones y doctrina
- **THEN** el sistema propone "no apto"

### Requirement: RF-603 Proponer apto con misa y oraciones

El sistema SHALL proponer "apto" cuando el niño cumple misa y oraciones, cumpla o no doctrina.

#### Scenario: Misa y oraciones

- **WHEN** un niño cumple misa y oraciones, cumpla o no doctrina
- **THEN** el sistema propone "apto"

#### Scenario: HU-602 Propuesta según la regla

- **WHEN** el coordinador consulta quién está apto
- **THEN** el sistema propone la aptitud de cada niño según la regla de misa, oraciones y doctrina, sin calcularla a mano

### Requirement: RF-603 Proponer no apto sin oraciones ni doctrina

El sistema SHALL proponer "no apto" cuando el niño cumple misa pero no cumple oraciones ni doctrina.

#### Scenario: Misa sin oraciones ni doctrina

- **WHEN** un niño cumple misa y no cumple ni oraciones ni doctrina
- **THEN** el sistema propone "no apto"

### Requirement: RF-603 Proponer a revisar con misa y doctrina

El sistema SHALL proponer "a revisar" cuando el niño cumple misa y doctrina pero no oraciones.

#### Scenario: Misa y doctrina sin oraciones

- **WHEN** un niño cumple misa y doctrina y no cumple oraciones
- **THEN** el sistema propone "a revisar"

### Requirement: RF-603 Proponer a revisar sin evaluación de doctrina

El sistema SHALL proponer "a revisar" si un niño no tiene ninguna evaluación de doctrina, en lugar de suponer que no cumple.

#### Scenario: Sin evaluación de doctrina

- **WHEN** un niño no tiene ninguna evaluación de doctrina
- **THEN** el sistema propone "a revisar" y no supone que no cumple doctrina

### Requirement: RF-603 Recalcular la propuesta

El sistema SHALL recalcular la propuesta cada vez que cambie un dato de las tres dimensiones o un umbral.

#### Scenario: Cambia un dato o un umbral

- **WHEN** cambia un dato de misa, oraciones o doctrina, o cambia un umbral
- **THEN** el sistema recalcula la propuesta

#### Scenario: Niño retirado durante el ciclo

- **WHEN** un niño se retira durante el ciclo
- **THEN** no aparece en la propuesta

### Requirement: RF-604 Decidir la aptitud

El sistema SHALL permitir decidir la aptitud solo a la coordinación o a quien la tenga delegada.

#### Scenario: Decide la coordinación o su delegado

- **WHEN** la coordinación o quien la tenga delegada registra la aptitud de un niño
- **THEN** el sistema acepta la decisión

#### Scenario: Otra persona intenta decidir

- **WHEN** alguien que no es la coordinación ni su delegado intenta decidir la aptitud
- **THEN** el sistema no registra la decisión

### Requirement: RF-604 Registrar la decisión final

El sistema SHALL registrar la decisión, quién la tomó, cuándo y, si difiere de la propuesta, el motivo, cuando la coordinación confirma o cambia la propuesta de un niño.

#### Scenario: HU-603 Confirmar la propuesta

- **WHEN** la coordinación confirma la propuesta de un niño
- **THEN** el sistema registra la decisión, quién la tomó y cuándo

#### Scenario: Decisión distinta de la propuesta

- **WHEN** la coordinación cambia la propuesta de un niño y no indica el motivo
- **THEN** el sistema no guarda la decisión
- **WHEN** la coordinación cambia la propuesta e indica el motivo
- **THEN** el sistema registra la decisión, quién la tomó, cuándo y el motivo

### Requirement: RF-604 Mantener la decisión y avisar

El sistema SHALL mantener la decisión cuando cambia un dato después de una decisión y, si la nueva propuesta difiere, avisar a la coordinación para que la confirme o la cambie.

#### Scenario: Cambio de datos posterior a la decisión

- **WHEN** cambia un dato después de una decisión y la nueva propuesta difiere
- **THEN** el sistema mantiene la decisión y avisa a la coordinación para que la confirme o la cambie

#### Scenario: Justificación aprobada después de la decisión

- **WHEN** se aprueba una justificación después de la decisión y la nueva propuesta difiere
- **THEN** el sistema mantiene la decisión y avisa a la coordinación

### Requirement: RF-605 Registrar saldo inicial desde papel

Donde el sistema empiece a usarse con el ciclo avanzado, el sistema SHALL permitir a la coordinación registrar por niño un saldo inicial: ausencias a misa no justificadas y oraciones ya sabidas hasta la fecha de inicio de uso.

#### Scenario: HU-604 Cargar lo registrado en papel

- **WHEN** el sistema empieza a usarse con el ciclo avanzado y la coordinación registra el saldo inicial de un niño
- **THEN** el sistema guarda las ausencias a misa no justificadas y las oraciones ya sabidas hasta la fecha de inicio de uso

### Requirement: RF-605 Marcar y sumar el saldo de papel

El sistema SHALL marcar ese saldo como "cargado desde papel", con quién lo cargó y cuándo, y sumarlo a las dimensiones.

#### Scenario: Ciclo empezado en papel

- **WHEN** la coordinación carga un saldo inicial desde papel
- **THEN** el sistema lo marca como "cargado desde papel", registra quién lo cargó y cuándo, y lo suma a lo registrado en el sistema

### Requirement: RF-606 Generar la lista de niños aptos

El sistema SHALL generar la lista de niños aptos con el resumen de sus tres dimensiones cuando la coordinación cierra las decisiones del ciclo.

#### Scenario: Cierre de las decisiones del ciclo

- **WHEN** la coordinación cierra las decisiones del ciclo
- **THEN** el sistema genera la lista de niños aptos con el resumen de misa, oraciones y doctrina, y esa lista coincide con las decisiones registradas

### Requirement: RF-606 Mostrar la lista a supervisión y secretaría

El sistema SHALL mostrar esa lista a la supervisión con su propia cuenta y permitir a la coordinación compartirla con secretaría.

#### Scenario: HU-605 Consulta del párroco

- **WHEN** el párroco consulta la lista de aptos con su propia cuenta
- **THEN** el sistema muestra la lista con el respaldo de asistencia y avance de cada niño

#### Scenario: Compartir la lista con secretaría

- **WHEN** la coordinación comparte la lista de aptos con secretaría
- **THEN** el sistema entrega esa lista a secretaría

### Requirement: RF-606 Conservar la lista como constancia

El sistema SHALL conservar esa lista como constancia del ciclo (spec 008).

#### Scenario: Lista guardada en el ciclo

- **WHEN** el sistema genera la lista de niños aptos al cierre del ciclo
- **THEN** conserva esa lista como constancia del ciclo

### Requirement: RNF-601 Cálculo explicable

Cada propuesta SHALL mostrar qué dimensiones cumple, cuáles no y con qué valores.

#### Scenario: Propuesta con sus dimensiones

- **WHEN** el sistema muestra la propuesta de aptitud de un niño
- **THEN** indica qué dimensiones cumple, cuáles no y con qué valores

### Requirement: RNF-602 Regla completa

La regla de RF-603 SHALL dar exactamente una propuesta para cada combinación posible de las tres dimensiones.

#### Scenario: Ocho combinaciones de las tres dimensiones

- **WHEN** se evalúan las ocho combinaciones en que misa, oraciones y doctrina se cumplen o no
- **THEN** cada combinación produce exactamente una propuesta, la que indica la regla

#### Scenario: Niño no bautizado

- **WHEN** un niño no está bautizado y recibirá el Bautismo y la Primera Comunión
- **THEN** la regla de las tres dimensiones da exactamente una propuesta para ese niño

### Requirement: RNF-603 Disponible sin conexión

El tablero de un grupo SHALL poder consultarse sin señal con los datos ya sincronizados (R19).

#### Scenario: Tablero del grupo sin señal

- **WHEN** se consulta el tablero de un grupo sin señal y los datos de ese grupo ya están sincronizados
- **THEN** el sistema muestra el tablero con esos datos
