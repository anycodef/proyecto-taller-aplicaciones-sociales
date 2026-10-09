# 004 — Justificaciones de ausencias

## Contexto y objetivo

Según la ficha de compromiso, tres faltas no justificadas llevan al retiro del niño. Hoy los padres justifican escribiendo al WhatsApp personal del coordinador, donde los mensajes se mezclan con los de amigos y familia y se pierden; en la cartilla a veces solo queda una "S" en lugar de la evidencia, y cuando hay reclamo es "la palabra del papá contra la del catequista". Una justificación perdida puede costarle el sacramento a un niño. El coordinador estima que los padres aceptarían justificar por un enlace, siempre que la evidencia solo la vean el párroco, la Madre Concepción, la coordinación y los catequistas.

**Objetivo:** que los padres justifiquen en pocos pasos desde su enlace personal, que cada justificación quede ligada de forma inequívoca al niño y a la ausencia con su evidencia, que la coordinación las revise en un solo lugar fuera de su WhatsApp, y que cualquier catequista del grupo pueda ver su estado.

## Usuarios

- **Familia:** justifica ausencias desde su enlace personal (spec 001, RF-110) y consulta el resultado.
- **Coordinación (o quien la tenga delegada):** revisa, aprueba o rechaza, y registra justificaciones en nombre de un apoderado.
- **Catequista:** consulta el estado de las justificaciones de su grupo para responder a los padres.
- **Supervisión (párroco, Madre Concepción):** consulta las justificaciones con su evidencia.

## Historias de usuario

- **HU-401.** Como apoderado, quiero abrir mi enlace, ver las ausencias pendientes de mi hijo, tomar la foto del comprobante y enviarla, sin instalar ni aprender nada.
- **HU-402.** Como apoderado, quiero justificar con un solo certificado varias ausencias o a varios de mis hijos.
- **HU-403.** Como apoderado, quiero avisar con anticipación de un evento escolar, para que la ausencia quede justificada desde antes.
- **HU-404.** Como coordinador, quiero revisar todas las justificaciones en una sola bandeja, fuera de mi WhatsApp personal.
- **HU-405.** Como coordinador, quiero registrar la justificación que un padre me trajo en papel o me mandó por WhatsApp, para que no se pierda mientras las familias se acostumbran.
- **HU-406.** Como catequista, quiero ver si la ausencia de un niño está justificada, para responder a su padre sin depender del coordinador.
- **HU-407.** Como apoderado, quiero saber si mi justificación fue aceptada.

## Requisitos funcionales

### RF-401 Ausencias por justificar
- Cuando un apoderado abre su enlace personal, el sistema deberá mostrarle primero las ausencias de sus hijos que aún pueden justificarse, con el niño, la fecha y la sesión ya indicados.
- El sistema deberá considerar justificable cualquier ausencia registrada: misa, catequesis o actividad obligatoria.
- El sistema deberá permitir abrir el enlace sin instalar nada.

### RF-402 Contenido de la justificación
- El sistema deberá exigir elegir una causa de una lista cerrada y adjuntar al menos una foto del comprobante.
- El sistema deberá ofrecer como causas: salud del niño, enfermedad o fallecimiento de un familiar directo y evento escolar comunicado con anticipación.
- Cuando el apoderado envía la justificación, el sistema deberá confirmar la recepción en pantalla.

### RF-403 Varias ausencias con una evidencia
- El sistema deberá permitir al apoderado seleccionar varias ausencias, de una o varias fechas y de uno o varios de sus hijos, y adjuntar una sola evidencia.
- Cuando se envía una justificación múltiple, el sistema deberá crear una justificación por cada ausencia seleccionada, todas con la misma evidencia y la misma causa.
- El sistema deberá permitir a la coordinación aprobar o rechazar esas justificaciones juntas o por separado.

### RF-404 Justificación anticipada
- Donde la causa sea un evento escolar, el sistema deberá permitir justificar antes de la fecha adjuntando el comunicado del colegio.

### RF-405 Plazo
- El sistema deberá permitir a la coordinación definir al inicio del ciclo el plazo, en días desde la ausencia, para justificarla.
- Cuando vence el plazo de una ausencia, el sistema deberá dejar de ofrecerla como justificable.

### RF-406 Registro en nombre del apoderado
- El sistema deberá permitir a la coordinación registrar una justificación en nombre de un apoderado, con la evidencia recibida por otro medio.
- El sistema deberá marcar esa justificación como "registrada por la coordinación en nombre de" ese apoderado, con quién la registró y cuándo.

### RF-407 Vínculo inequívoco con el perfil
- El sistema deberá guardar cada justificación en el perfil del niño, ligada a la ausencia que justifica (fecha y sesión), con su evidencia, la causa, la fecha de envío y quién la envió.
- El sistema no deberá permitir borrar una justificación ni su evidencia, salvo por retiro del consentimiento o vencimiento de la retención (spec 001, RF-106 y RF-108).
- Cuando una ausencia justificada se corrige a presente, el sistema deberá dejar la justificación sin efecto y conservarla.

### RF-408 Revisión
- El sistema deberá reunir en una bandeja todas las justificaciones pendientes del ciclo, con su evidencia.
- El sistema deberá permitir aprobar o rechazar justificaciones solo a la coordinación o a quien la tenga delegada.
- Cuando se aprueba o rechaza una justificación, el sistema deberá registrar quién, cuándo y, en caso de rechazo, el motivo.
- Cuando se rechaza una justificación y el plazo de la ausencia sigue vigente, el sistema deberá volver a ofrecerla como justificable al apoderado.

### RF-409 Efectos de la aprobación
- Cuando se aprueba la justificación de una falta (spec 003, RF-311), el sistema deberá dejar de contarla para la regla de retiro.
- Cuando se aprueba la justificación de una ausencia a misa, el sistema no deberá contarla en contra en la aptitud sacramental (spec 006).

### RF-410 Visibilidad
- El sistema deberá mostrar a los catequistas del grupo el estado de cada justificación (pendiente, aprobada, rechazada o sin efecto).
- El sistema deberá mostrar la evidencia solo a la coordinación, a los catequistas del grupo y a la supervisión.
- El sistema deberá mostrar al apoderado el estado de sus justificaciones y, si fue rechazada, el motivo.

## Requisitos no funcionales

- **RNF-401 Sencillez.** Un apoderado deberá completar una justificación en menos de 1 minuto: elegir la ausencia, la causa y la foto, y enviar (R9, R27).
- **RNF-402 Datos mínimos.** La foto deberá reducirse antes de enviarse para pesar menos de 300 KB (R20).
- **RNF-403 Evidencia protegida.** La evidencia solo deberá poder verse con enlaces de vigencia limitada y por personas autorizadas.
- **RNF-404 Evidencia fuera del celular.** Si no hay conexión al enviar, el sistema deberá avisar con claridad que la justificación no se envió y no deberá guardar la evidencia para enviarla después (spec 001, RNF-101).
- **RNF-405 Revisión con conexión.** La revisión de justificaciones requiere conexión, porque la evidencia nunca está en el celular.

## Casos límite

- Ausencia cuyo plazo venció: ya no aparece como justificable.
- Foto ilegible: la coordinación la rechaza con motivo y el apoderado puede enviar otra si el plazo sigue vigente.
- Certificado que cubre tres domingos: una sola evidencia, tres justificaciones.
- Dos hermanos que faltaron el mismo domingo: una sola evidencia, una justificación por niño.
- Ausencia corregida a presente: la justificación queda sin efecto pero se conserva.
- Dos apoderados justifican la misma ausencia: ambas quedan registradas y la coordinación resuelve.
- Causa no incluida en la lista (viaje, fiesta): no es justificable según la ficha de compromiso.
- Padre que manda la justificación al WhatsApp del coordinador: la coordinación la registra en su nombre.
- Apoderado sin señal al enviar: se le avisa y debe reenviar con conexión.
- Enlace revocado con justificaciones pendientes: las pendientes se conservan y se revisan igual.

## Fuera de alcance

- Lectura automática (OCR) del comprobante: posterior al MVP.
- Recibir justificaciones por WhatsApp de forma automática.
- Chat entre apoderados y catequistas.
- Justificaciones de catequistas.

## Criterios de finalización

- Un apoderado abre su enlace en un celular sin la aplicación, ve la ausencia pendiente, adjunta una foto y envía en menos de 1 minuto.
- Una justificación con una evidencia para tres fechas crea tres justificaciones ligadas a sus fechas.
- La justificación aparece en el perfil del niño y en la bandeja de la coordinación; solo la coordinación puede aprobarla.
- Tras aprobarla, la falta deja de contar para la regla de retiro.
- Vencido el plazo, la ausencia deja de ofrecerse.
- Una justificación registrada por la coordinación en nombre de un apoderado queda marcada como tal.
- Un catequista del grupo ve el estado y uno de otro grupo no ve nada.
- Sin conexión, el envío falla con aviso y la foto no queda guardada por el sistema.

## Dudas abiertas

- **[NECESITA ACLARACIÓN]** ¿Cómo se entera el apoderado de que su justificación fue revisada, si no vuelve a abrir su enlace?
- **[NECESITA ACLARACIÓN]** ¿Quiénes son "familiar directo": padres y hermanos, o también abuelos?
- **[NECESITA ACLARACIÓN]** ¿Con cuánta anticipación debe avisarse un evento escolar? ¿Una cita médica programada también se puede justificar por adelantado?
- **[NECESITA ACLARACIÓN]** ¿La coordinación puede registrar en nombre de un apoderado una justificación cuyo plazo ya venció?
- **[NECESITA ACLARACIÓN]** ¿Una justificación aprobada puede revertirse si se descubre que era falsa?
- **[NECESITA ACLARACIÓN]** ¿Se aceptan capturas de pantalla o documentos además de fotos? ¿Cuántas imágenes como máximo?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R7 Fuera del WhatsApp personal | RF-401, RF-406, RF-408 |
| R8 Evidencia inequívoca en el perfil | RF-402, RF-403, RF-407, RF-410 |
| R9 Mecanismo sencillo para padres | RF-401, RF-402, RF-403, RF-404, RNF-401 |
