# Justificaciones de ausencias

## Purpose

Que los padres justifiquen en pocos pasos desde su enlace personal, que cada justificación quede ligada de forma inequívoca al niño y a la ausencia con su evidencia, que la coordinación las revise en un solo lugar fuera de su WhatsApp, y que cualquier catequista del grupo pueda ver su estado. La familia justifica y consulta el resultado. La coordinación revisa, aprueba o rechaza, y puede registrar en nombre de un apoderado. El catequista consulta el estado para responder a los padres. La supervisión consulta las justificaciones con su evidencia.

## Requirements

### Requirement: RF-401 Mostrar ausencias que aún pueden justificarse

Cuando un apoderado abre su enlace personal, el sistema SHALL mostrarle primero las ausencias de sus hijos que aún pueden justificarse, con el niño, la fecha y la sesión ya indicados.

#### Scenario: HU-401 Abrir el enlace y ver la ausencia

- **WHEN** un apoderado abre su enlace personal
- **THEN** el sistema le muestra primero las ausencias de sus hijos que aún pueden justificarse, con el niño, la fecha y la sesión

### Requirement: RF-401 Ausencia justificable

El sistema SHALL considerar justificable cualquier ausencia registrada: misa, catequesis o actividad obligatoria.

#### Scenario: Tipo de ausencia

- **WHEN** existe una ausencia registrada de misa, catequesis o actividad obligatoria y su plazo sigue vigente
- **THEN** el sistema la considera justificable

### Requirement: RF-401 Abrir el enlace sin instalar

El sistema SHALL permitir abrir el enlace sin instalar nada.

#### Scenario: Celular sin la aplicación

- **WHEN** un apoderado abre su enlace en un celular sin la aplicación
- **THEN** el sistema le permite ver la ausencia y enviar la justificación

### Requirement: RF-402 Exigir causa y foto

El sistema SHALL exigir elegir una causa de una lista cerrada y adjuntar al menos una foto del comprobante.

#### Scenario: Enviar sin causa o sin foto

- **WHEN** el apoderado intenta enviar una justificación sin causa o sin foto del comprobante
- **THEN** el sistema no la acepta

#### Scenario: Causa fuera de la lista

- **WHEN** la causa es un viaje o una fiesta, u otra que no está en la lista
- **THEN** el sistema no la trata como justificable

### Requirement: RF-402 Causas de la lista

El sistema SHALL ofrecer como causas: salud del niño, enfermedad o fallecimiento de un familiar directo y evento escolar comunicado con anticipación.

#### Scenario: Elegir una causa

- **WHEN** el apoderado elige la causa
- **THEN** el sistema ofrece salud del niño, enfermedad o fallecimiento de un familiar directo y evento escolar comunicado con anticipación

### Requirement: RF-402 Confirmar la recepción

Cuando el apoderado envía la justificación, el sistema SHALL confirmar la recepción en pantalla.

#### Scenario: Envío recibido

- **WHEN** el apoderado envía la justificación
- **THEN** el sistema confirma la recepción en pantalla

### Requirement: RF-403 Seleccionar varias ausencias

El sistema SHALL permitir al apoderado seleccionar varias ausencias, de una o varias fechas y de uno o varios de sus hijos, y adjuntar una sola evidencia.

#### Scenario: HU-402 Un certificado para varias ausencias

- **WHEN** un apoderado selecciona varias ausencias, de una o varias fechas y de uno o varios hijos
- **THEN** el sistema le permite adjuntar una sola evidencia

### Requirement: RF-403 Una justificación por ausencia

Cuando se envía una justificación múltiple, el sistema SHALL crear una justificación por cada ausencia seleccionada, todas con la misma evidencia y la misma causa.

#### Scenario: Certificado que cubre tres domingos

- **WHEN** se envía una evidencia para tres ausencias
- **THEN** el sistema crea tres justificaciones, todas con la misma evidencia y la misma causa

#### Scenario: Dos hermanos el mismo domingo

- **WHEN** dos hermanos faltaron el mismo domingo y se adjunta una sola evidencia
- **THEN** el sistema crea una justificación por niño, con esa evidencia

### Requirement: RF-403 Aprobar juntas o por separado

El sistema SHALL permitir a la coordinación aprobar o rechazar esas justificaciones juntas o por separado.

#### Scenario: Revisión de una justificación múltiple

- **WHEN** la coordinación revisa las justificaciones creadas con una misma evidencia
- **THEN** puede aprobarlas o rechazarlas juntas o por separado

### Requirement: RF-404 Justificación anticipada de evento escolar

Donde la causa sea un evento escolar, el sistema SHALL permitir justificar antes de la fecha adjuntando el comunicado del colegio.

#### Scenario: HU-403 Avisar un evento escolar

- **WHEN** la causa es un evento escolar y el apoderado adjunta el comunicado del colegio antes de la fecha
- **THEN** el sistema registra la justificación anticipada

### Requirement: RF-405 Definir el plazo

El sistema SHALL permitir a la coordinación definir al inicio del ciclo el plazo, en días desde la ausencia, para justificarla.

#### Scenario: Plazo del ciclo

- **WHEN** la coordinación define al inicio del ciclo el plazo en días desde la ausencia
- **THEN** el sistema usa ese plazo para ofrecer las ausencias como justificables

### Requirement: RF-405 Dejar de ofrecer la ausencia vencida

Cuando vence el plazo de una ausencia, el sistema SHALL dejar de ofrecerla como justificable.

#### Scenario: Ausencia cuyo plazo venció

- **WHEN** vence el plazo de una ausencia
- **THEN** el sistema deja de ofrecerla como justificable

### Requirement: RF-406 Registrar en nombre del apoderado

El sistema SHALL permitir a la coordinación registrar una justificación en nombre de un apoderado, con la evidencia recibida por otro medio.

#### Scenario: HU-405 Justificación traída en papel o por WhatsApp

- **WHEN** un padre trae la justificación en papel o la manda al WhatsApp del coordinador
- **THEN** la coordinación puede registrarla en nombre de ese apoderado, con la evidencia recibida

### Requirement: RF-406 Marcar quién la registró

El sistema SHALL marcar esa justificación como "registrada por la coordinación en nombre de" ese apoderado, con quién la registró y cuándo.

#### Scenario: Marca de registro en nombre del apoderado

- **WHEN** la coordinación registra una justificación en nombre de un apoderado
- **THEN** el sistema la marca como "registrada por la coordinación en nombre de" ese apoderado, con quién la registró y cuándo

### Requirement: RF-407 Guardar la justificación en el perfil

El sistema SHALL guardar cada justificación en el perfil del niño, ligada a la ausencia que justifica (fecha y sesión), con su evidencia, la causa, la fecha de envío y quién la envió.

#### Scenario: Justificación en el perfil

- **WHEN** se envía una justificación
- **THEN** el sistema la guarda en el perfil del niño, ligada a la fecha y la sesión, con su evidencia, la causa, la fecha de envío y quién la envió

#### Scenario: Dos apoderados justifican la misma ausencia

- **WHEN** dos apoderados justifican la misma ausencia
- **THEN** ambas justificaciones quedan registradas y la coordinación las resuelve

### Requirement: RF-407 No borrar la justificación

El sistema SHALL NOT permitir borrar una justificación ni su evidencia, salvo por retiro del consentimiento o vencimiento de la retención (spec 001, RF-106 y RF-108).

#### Scenario: Intento de borrar

- **WHEN** se intenta borrar una justificación o su evidencia fuera del retiro del consentimiento o de la retención
- **THEN** el sistema no la borra

### Requirement: RF-407 Dejar sin efecto si pasa a presente

Cuando una ausencia justificada se corrige a presente, el sistema SHALL dejar la justificación sin efecto y conservarla.

#### Scenario: Ausencia corregida a presente

- **WHEN** una ausencia justificada se corrige a presente
- **THEN** la justificación queda sin efecto y se conserva

### Requirement: RF-408 Bandeja de pendientes

El sistema SHALL reunir en una bandeja todas las justificaciones pendientes del ciclo, con su evidencia.

#### Scenario: HU-404 Bandeja fuera de WhatsApp

- **WHEN** la coordinación abre la bandeja
- **THEN** el sistema reúne todas las justificaciones pendientes del ciclo, con su evidencia

#### Scenario: Enlace revocado con pendientes

- **WHEN** se revoca el enlace de un apoderado que tiene justificaciones pendientes
- **THEN** esas pendientes se conservan y se revisan igual

### Requirement: RF-408 Aprobar o rechazar solo la coordinación

El sistema SHALL permitir aprobar o rechazar justificaciones solo a la coordinación o a quien la tenga delegada.

#### Scenario: Quién revisa

- **WHEN** la coordinación o su delegado aprueba o rechaza una justificación
- **THEN** el sistema registra la decisión
- **WHEN** otra persona intenta aprobarla o rechazarla
- **THEN** el sistema no lo permite

### Requirement: RF-408 Registrar la revisión

Cuando se aprueba o rechaza una justificación, el sistema SHALL registrar quién, cuándo y, en caso de rechazo, el motivo.

#### Scenario: Foto ilegible

- **WHEN** la coordinación rechaza una justificación porque la foto es ilegible
- **THEN** el sistema registra quién la rechazó, cuándo y el motivo

### Requirement: RF-408 Volver a ofrecer si el plazo sigue vigente

Cuando se rechaza una justificación y el plazo de la ausencia sigue vigente, el sistema SHALL volver a ofrecerla como justificable al apoderado.

#### Scenario: Rechazo dentro del plazo

- **WHEN** se rechaza una justificación y el plazo de la ausencia sigue vigente
- **THEN** el sistema vuelve a ofrecer esa ausencia al apoderado para que envíe otra

### Requirement: RF-409 Dejar de contar la falta

Cuando se aprueba la justificación de una falta (spec 003, RF-311), el sistema SHALL dejar de contarla para la regla de retiro.

#### Scenario: Falta aprobada

- **WHEN** se aprueba la justificación de una falta
- **THEN** el sistema deja de contarla para la regla de retiro

### Requirement: RF-409 No contar la ausencia a misa en la aptitud

Cuando se aprueba la justificación de una ausencia a misa, el sistema SHALL NOT contarla en contra en la aptitud sacramental (spec 006).

#### Scenario: Misa justificada

- **WHEN** se aprueba la justificación de una ausencia a misa
- **THEN** el sistema no la cuenta en contra en la aptitud sacramental

### Requirement: RF-410 Mostrar el estado a los catequistas del grupo

El sistema SHALL mostrar a los catequistas del grupo el estado de cada justificación (pendiente, aprobada, rechazada o sin efecto).

#### Scenario: HU-406 Estado para responder al padre

- **WHEN** un catequista del grupo consulta la ausencia de un niño
- **THEN** el sistema muestra si la justificación está pendiente, aprobada, rechazada o sin efecto
- **WHEN** un catequista de otro grupo la consulta
- **THEN** el sistema no le muestra nada

### Requirement: RF-410 Mostrar la evidencia a quien corresponde

El sistema SHALL mostrar la evidencia solo a la coordinación, a los catequistas del grupo y a la supervisión.

#### Scenario: Quién ve la evidencia

- **WHEN** la coordinación, un catequista del grupo o la supervisión abre una justificación
- **THEN** el sistema muestra la evidencia
- **WHEN** otra persona la abre
- **THEN** el sistema no muestra la evidencia

### Requirement: RF-410 Mostrar el resultado al apoderado

El sistema SHALL mostrar al apoderado el estado de sus justificaciones y, si fue rechazada, el motivo.

#### Scenario: HU-407 Saber si fue aceptada

- **WHEN** el apoderado consulta una justificación enviada
- **THEN** el sistema muestra su estado y, si fue rechazada, el motivo

### Requirement: RNF-401 Sencillez

Un apoderado SHALL completar una justificación en menos de 1 minuto: elegir la ausencia, la causa y la foto, y enviar (R9, R27).

#### Scenario: Envío en menos de un minuto

- **WHEN** un apoderado elige la ausencia, la causa y la foto, y envía
- **THEN** completa la justificación en menos de 1 minuto

### Requirement: RNF-402 Foto reducida

La foto SHALL reducirse antes de enviarse para pesar menos de 300 KB (R20).

#### Scenario: Tamaño de la foto

- **WHEN** el apoderado adjunta la foto del comprobante
- **THEN** el sistema la reduce antes de enviarla para que pese menos de 300 KB

### Requirement: RNF-403 Evidencia protegida

La evidencia solo SHALL poder verse con enlaces de vigencia limitada y por personas autorizadas.

#### Scenario: Acceso a la evidencia

- **WHEN** una persona autorizada abre la evidencia
- **THEN** el sistema se la muestra mediante un enlace de vigencia limitada

### Requirement: RNF-404 No guardar la evidencia sin conexión

Si no hay conexión al enviar, el sistema SHALL avisar con claridad que la justificación no se envió y SHALL NOT guardar la evidencia para enviarla después (spec 001, RNF-101).

#### Scenario: Apoderado sin señal al enviar

- **WHEN** no hay conexión al enviar la justificación
- **THEN** el sistema avisa que no se envió y no guarda la evidencia para enviarla después

### Requirement: RNF-405 Revisión con conexión

La revisión de justificaciones requiere conexión, porque la evidencia nunca está en el celular. El sistema SHALL exigir conexión para revisar una justificación.

#### Scenario: Revisar sin conexión

- **WHEN** no hay conexión y la coordinación intenta revisar una justificación
- **THEN** el sistema no muestra la evidencia ni permite completar la revisión
