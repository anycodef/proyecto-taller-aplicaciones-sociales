# 006 — Aptitud sacramental

## Contexto y objetivo

Al final del ciclo la coordinación presenta a la Madre Concepción, al párroco y a secretaría la lista de niños que recibirán el sacramento. El criterio, según el coordinador, combina tres dimensiones: la misa ("lo más importante"), las oraciones y la doctrina. Un niño que va a misa y sabe las oraciones puede recibir el sacramento aunque falle un poco en doctrina; uno que no maneja ni doctrina ni oraciones no lo recibe aunque vaya a misa. Hoy esa decisión se toma sin un registro anual que la respalde, y el párroco duda de las cifras.

**Objetivo:** mostrar durante todo el año, por niño, el estado de las tres dimensiones, proponer su aptitud con una regla completa y explicable, y dejar registrada la decisión final de la coordinación con su justificación.

## Usuarios

- **Coordinación (o quien la tenga delegada):** fija los umbrales, revisa las propuestas y decide.
- **Catequista:** consulta la situación de los niños de su grupo durante el año.
- **Supervisión (párroco, Madre Concepción):** consulta las decisiones y sus respaldos con su propia cuenta.
- **Familia:** ve cómo va su hijo en las tres dimensiones.

## Historias de usuario

- **HU-601.** Como coordinador, quiero ver en cualquier momento del año qué niños van bien y cuáles no en misa, oraciones y doctrina, para actuar a tiempo.
- **HU-602.** Como coordinador, quiero que el sistema proponga quién está apto según nuestra regla, para no calcularlo a mano.
- **HU-603.** Como coordinador, quiero dejar registrada la decisión final y su motivo, para responder si alguien la cuestiona.
- **HU-604.** Como coordinador, quiero cargar lo que ya registramos en papel antes de usar el sistema, para que la aptitud tome en cuenta todo el ciclo.
- **HU-605.** Como párroco, quiero consultar la lista de aptos con el respaldo de asistencia y avance de cada niño.

## Requisitos funcionales

### RF-601 Umbrales
- El sistema deberá permitir a la coordinación fijar al inicio del ciclo: el máximo de ausencias a misa no justificadas, el mínimo de oraciones sabidas de las 10 y el criterio de doctrina.
- Cuando la coordinación cambia un umbral durante el ciclo, el sistema deberá registrar el cambio y recalcular todas las propuestas.
- Mientras falte algún umbral, el sistema deberá mostrar las dimensiones sin proponer aptitud.

### RF-602 Dimensiones
- El sistema deberá considerar que un niño cumple misa cuando sus ausencias a misa no justificadas del ciclo no superan el máximo fijado; las ausencias justificadas aprobadas (spec 004, RF-409) y los domingos sin misa (spec 003, RF-301) no cuentan.
- El sistema deberá considerar que un niño cumple oraciones cuando sabe al menos el mínimo de oraciones fijado (spec 005, RF-502).
- El sistema deberá considerar que un niño cumple doctrina según el criterio fijado. **[NECESITA ACLARACIÓN]**
- El sistema deberá mostrar por niño el estado de cada dimensión con su valor: ausencias a misa no justificadas frente al máximo, oraciones sabidas frente al mínimo y la situación en doctrina.

### RF-603 Propuesta de aptitud
- El sistema deberá proponer "no apto" cuando el niño no cumple misa, cumpla o no las demás dimensiones.
- El sistema deberá proponer "apto" cuando el niño cumple misa y oraciones, cumpla o no doctrina.
- El sistema deberá proponer "no apto" cuando el niño cumple misa pero no cumple oraciones ni doctrina.
- El sistema deberá proponer "a revisar" cuando el niño cumple misa y doctrina pero no oraciones.
- Si un niño no tiene ninguna evaluación de doctrina, entonces el sistema deberá proponer "a revisar" en lugar de suponer que no cumple.
- El sistema deberá recalcular la propuesta cada vez que cambie un dato de las tres dimensiones o un umbral.

### RF-604 Decisión final
- El sistema deberá permitir decidir la aptitud solo a la coordinación o a quien la tenga delegada.
- Cuando la coordinación confirma o cambia la propuesta de un niño, el sistema deberá registrar la decisión, quién la tomó, cuándo y, si difiere de la propuesta, el motivo.
- Cuando cambia un dato después de una decisión, el sistema deberá mantener la decisión y, si la nueva propuesta difiere, avisar a la coordinación para que la confirme o la cambie.

### RF-605 Saldo inicial desde papel
- Donde el sistema empiece a usarse con el ciclo avanzado, el sistema deberá permitir a la coordinación registrar por niño un saldo inicial: ausencias a misa no justificadas y oraciones ya sabidas hasta la fecha de inicio de uso.
- El sistema deberá marcar ese saldo como "cargado desde papel", con quién lo cargó y cuándo, y sumarlo a las dimensiones.

### RF-606 Lista para el sacramento
- Cuando la coordinación cierra las decisiones del ciclo, el sistema deberá generar la lista de niños aptos con el resumen de sus tres dimensiones.
- El sistema deberá mostrar esa lista a la supervisión con su propia cuenta y permitir a la coordinación compartirla con secretaría.
- El sistema deberá conservar esa lista como constancia del ciclo (spec 008).

## Requisitos no funcionales

- **RNF-601 Cálculo explicable.** Cada propuesta deberá mostrar qué dimensiones cumple, cuáles no y con qué valores.
- **RNF-602 Regla completa.** La regla de RF-603 deberá dar exactamente una propuesta para cada combinación posible de las tres dimensiones.
- **RNF-603 Disponible sin conexión.** El tablero de un grupo deberá poder consultarse sin señal con los datos ya sincronizados (R19).

## Casos límite

- Niño con ausencias a misa justificadas: no cuentan contra el máximo.
- Niño inscrito a mitad del ciclo: solo cuentan las misas desde su inscripción.
- Niño retirado durante el ciclo: no aparece en la propuesta.
- Niño no bautizado que recibirá el Bautismo y la Primera Comunión.
- Cambio de umbrales a mitad del ciclo: recalcula todas las propuestas y avisa de las decisiones afectadas.
- Justificación aprobada después de la decisión: la decisión se mantiene y se avisa si la propuesta cambió.
- Ciclo empezado en papel: el saldo inicial se suma a lo registrado en el sistema.
- Niño que asiste a misa en otro horario: cuenta como ausente salvo justificación (spec 003, fuera de alcance).

## Fuera de alcance

- Emisión de constancias o certificados de sacramento.
- Gestión de padrinos y de la ceremonia (fotos, flores).
- Visto bueno de la supervisión dentro del sistema.
- Cargar desde papel el detalle de cada domingo anterior al inicio de uso.

## Criterios de finalización

- Con datos de prueba, las ocho combinaciones de las tres dimensiones producen la propuesta que indica la regla.
- Un niño sin misa queda "no apto" aunque cumpla oraciones y doctrina.
- Una decisión distinta de la propuesta no puede guardarse sin motivo.
- Un cambio de datos posterior a una decisión genera un aviso y no cambia la decisión.
- Un saldo cargado desde papel se suma a las dimensiones y queda marcado.
- La lista final coincide con las decisiones registradas, la supervisión la ve y queda guardada en el ciclo.

## Dudas abiertas

- **[NECESITA ACLARACIÓN]** Criterio para que un niño "cumpla" doctrina: depende del método de evaluación pendiente en la spec 005.
- **[NECESITA ACLARACIÓN]** Valores iniciales del máximo de ausencias a misa y del mínimo de oraciones.
- **[NECESITA ACLARACIÓN]** ¿Las actividades obligatorias (spec 005) forman parte de la aptitud?
- **[NECESITA ACLARACIÓN]** ¿Estar en seguimiento por ficha de compromiso (spec 007) afecta la aptitud?
- **[NECESITA ACLARACIÓN]** ¿Hay una lista por sacramento (Bautismo y Primera Comunión)?
- **[NECESITA ACLARACIÓN]** ¿Qué pasa con un niño "no apto": repite el ciclo o pasa a otro grupo?
- **[NECESITA ACLARACIÓN]** Si la coordinación y su delegado deciden distinto sobre el mismo niño sin conexión, ¿qué decisión prevalece?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R13 Trazabilidad de las tres dimensiones | RF-601, RF-602, RF-603, RF-604, RF-605, RF-606 |
