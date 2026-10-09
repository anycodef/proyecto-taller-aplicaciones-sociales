# 007 — Riesgo de deserción

## Contexto y objetivo

Uno de cada tres niños inscritos abandona durante el ciclo (98 inscritos, 65 recibieron el sacramento). El equipo ya tiene un proceso: con dos faltas, consecutivas o no, se habla con el padre; con tres faltas no justificadas se cita al padre y se firma una ficha de compromiso; si el niño falta una vez más, se le retira. Y "si el padre no responde y el niño ya no viene, entendemos que se salió sin avisar". Hoy ese proceso depende de que la coordinación revise un Excel que no alcanza a mantener, y hubo retiros al final del ciclo por dudas de los padres que no se resolvieron a tiempo.

**Objetivo:** que el sistema avise a tiempo, siguiendo el proceso que el equipo ya usa, qué niños están en riesgo y en qué paso están, que detecte el abandono silencioso y que quede registrado cada contacto con la familia. El retiro siempre lo decide una persona.

## Usuarios

- **Coordinación (o quien la tenga delegada):** revisa las alertas, cita a los padres, registra fichas y confirma retiros.
- **Catequista:** ve las alertas de su grupo y registra los contactos con los padres.
- **Familia:** ve las faltas de su hijo (alcance exacto pendiente en spec 001).

## Historias de usuario

- **HU-701.** Como coordinador, quiero saber qué niños llegaron a dos faltas, para hablar con sus padres a tiempo.
- **HU-702.** Como coordinador, quiero que el sistema me diga cuándo un niño llegó a tres faltas no justificadas, para citar al padre y firmar la ficha.
- **HU-703.** Como coordinador, quiero enterarme de los niños que dejaron de venir sin avisar, para confirmar si se retiraron.
- **HU-704.** Como catequista, quiero registrar que hablé con el padre y qué me respondió, para que todo el equipo lo sepa.
- **HU-705.** Como coordinador, quiero cargar las faltas y fichas que ya llevaba en papel, para que nadie empiece de cero si adoptamos el sistema a mitad de ciclo.

## Requisitos funcionales

### RF-701 Conteo de faltas
- El sistema deberá contar como falta lo definido en la spec 003 (RF-311): un domingo sin misa ni catequesis, o una jornada sin asistencia.
- El sistema deberá sumar una falta al conteo de alertas solo cuando venció su plazo de justificación (spec 004, RF-405) y no tiene una justificación aprobada ni pendiente de revisión.
- Si al vencer el plazo hay una justificación pendiente de revisión, entonces el sistema deberá esperar a la revisión: si se rechaza, la falta se suma; si se aprueba, no.
- Mientras una falta esté dentro de su plazo, el sistema deberá mostrarla como "pendiente de justificar" sin sumarla.

### RF-702 Pasos del proceso
El sistema deberá ubicar a cada niño activo en uno de estos pasos, según su conteo de faltas:

| Paso | Condición | Alerta |
| --- | --- | --- |
| Sin riesgo | 0 o 1 falta | — |
| Contacto | 2 faltas | Contactar al apoderado (catequista del grupo y coordinación) |
| Citación | 3 faltas, sin ficha firmada | Citar al apoderado y firmar la ficha (coordinación) |
| Seguimiento | 3 faltas, con ficha firmada | — |
| Alerta de retiro | 4 o más faltas, con o sin ficha | Decidir el retiro (coordinación) |
| Retirado | Retiro confirmado | — |

- Cuando un niño sube de paso, el sistema deberá mostrar la alerta correspondiente en la lista de riesgo y en su perfil.
- Si un niño llega a la alerta de retiro sin ficha firmada, entonces el sistema deberá indicarlo en la alerta.
- Cuando el conteo baja (por una justificación aprobada o una corrección de asistencia), el sistema deberá devolver al niño al paso que corresponde y cerrar las alertas que ya no aplican.

### RF-703 Ficha de compromiso por faltas
- Cuando la coordinación registra que el apoderado firmó la ficha de compromiso, el sistema deberá guardar la fecha, el apoderado que firmó y quién la registró, sin imagen del documento.

### RF-704 Retiro
- El sistema no deberá retirar a ningún niño de forma automática.
- Cuando la coordinación confirma un retiro, el sistema deberá exigir un motivo, registrar quién y cuándo, y marcar al niño como inactivo.

### RF-705 Posible abandono
- El sistema deberá permitir a la coordinación fijar un número de domingos seguidos sin misa ni catequesis.
- Cuando un niño alcanza ese número y el último contacto registrado tiene el resultado "no responde" o no hay contacto, el sistema deberá marcarlo como "posible abandono" para que la coordinación confirme o descarte el retiro.

### RF-706 Registro de contactos
- El sistema deberá permitir registrar cada contacto con el apoderado: fecha, apoderado contactado, quién contactó y un resultado de una lista cerrada (no responde, se compromete a volver, justificará, se retira, otro).
- El sistema deberá permitir añadir una nota corta opcional, sin datos de salud ni situaciones familiares.
- Cuando se registra un contacto sobre un niño en el paso "contacto", el sistema deberá cerrar esa alerta.

### RF-707 Lista de riesgo
- El sistema deberá mostrar a la coordinación la lista de niños en riesgo ordenada por paso, con las faltas que originaron cada alerta.
- El sistema deberá mostrar a cada catequista la lista de riesgo de sus grupos.

### RF-708 Saldo inicial desde papel
- Donde el sistema empiece a usarse con el ciclo avanzado, el sistema deberá permitir a la coordinación cargar por niño las faltas no justificadas acumuladas y si ya firmó la ficha de compromiso.
- El sistema deberá marcar ese saldo como "cargado desde papel", con quién lo cargó y cuándo, y ubicar al niño en el paso que le corresponde.

## Requisitos no funcionales

- **RNF-701 Alerta oportuna.** Las alertas deberán aparecer en cuanto vence el plazo de justificación de una falta y los registros del domingo están sincronizados, sin pasos manuales.
- **RNF-702 Reglas explicables.** Cada alerta deberá indicar qué faltas la originaron.
- **RNF-703 Fuera del camino crítico.** Calcular el riesgo no deberá hacer más lenta la toma de asistencia.
- **RNF-704 Sin alertas falsas sin conexión.** Las alertas deberán calcularse con los registros ya sincronizados de todos los catequistas, no con los datos parciales de un solo celular.
- **RNF-705 Costo cero.** Las alertas se muestran dentro del sistema; no deberán enviar mensajes con costo (R23).

## Casos límite

- Falta justificada dentro del plazo: nunca suma.
- Falta con justificación pendiente al vencer el plazo: espera a la revisión.
- Asistencia corregida a presente: el conteo baja y las alertas se recalculan.
- Cuarta falta sin ficha firmada: alerta de retiro, marcada "sin ficha firmada".
- Apoderado que se niega a firmar: la ficha no se registra y el proceso sigue su curso.
- Niño que deja de venir sin que el apoderado responda: posible abandono.
- Contacto con uno de dos apoderados: queda registrado a cuál se contactó.
- Niño que cambia de grupo con alertas abiertas: las alertas lo siguen al nuevo grupo.
- Ciclo empezado en papel: el niño arranca en el paso que corresponde a su saldo.

## Fuera de alcance

- Modelos predictivos o puntajes de riesgo calculados de forma estadística.
- Señales de riesgo por oraciones o doctrina (se ven en la aptitud, spec 006).
- Envío automático de mensajes a los padres.
- Seguimiento de la perseverancia después del sacramento.

## Criterios de finalización

- Con datos de prueba, 2, 3 y 4 faltas no justificadas llevan a los pasos contacto, citación y alerta de retiro.
- Una falta dentro de su plazo no suma; al vencer sin justificación, suma.
- Aprobar una justificación baja el conteo y cierra las alertas que ya no aplican.
- La cuarta falta sin ficha genera la alerta de retiro marcada "sin ficha firmada".
- N domingos seguidos sin asistencia y sin respuesta del apoderado marcan "posible abandono".
- Ningún niño queda retirado sin una confirmación humana con motivo.
- Un saldo cargado desde papel ubica al niño en el paso correcto.

## Dudas abiertas

- **[NECESITA ACLARACIÓN]** Una jornada en domingo a la que el niño no va: ¿suma 1 falta o 2?
- **[NECESITA ACLARACIÓN]** ¿Un niño retirado puede reincorporarse en el mismo ciclo? ¿Qué pasa con sus faltas?
- **[NECESITA ACLARACIÓN]** Si se aprueba una justificación después de confirmar el retiro, ¿el retiro se revierte?
- **[NECESITA ACLARACIÓN]** ¿Cómo se enteran la coordinación y los catequistas de una alerta nueva si no abren el sistema?
- **[NECESITA ACLARACIÓN]** Valor inicial de los domingos seguidos para "posible abandono".
- **[NECESITA ACLARACIÓN]** ¿Qué pasa con las alertas abiertas al cerrar el ciclo?
- **[NECESITA ACLARACIÓN]** ¿Otros factores de riesgo deben registrarse (no conseguir padrino, dudas de los padres)?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R14 Detección temprana de deserción | RF-701 a RF-708 |
