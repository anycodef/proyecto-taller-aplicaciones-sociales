# 003 — Asistencia dominical

## Contexto y objetivo

Cada domingo hay misa a las 8:00 y catequesis de 9:50 a 11:30 en el centro cultural. Hoy la asistencia a misa se marca en un cartón que los niños olvidan y el párroco la estima con manos levantadas: ve unos 35 niños de 97 inscritos y cuestiona a la coordinación cuando en diciembre se presentan 70 para la Primera Comunión. Parte de esa diferencia es inasistencia real, porque algunos padres retiran a sus hijos entre la misa y la catequesis. Las herramientas anteriores se abandonaron porque tomaban más tiempo que el papel, y en el local la señal no llega del primer al tercer piso.

**Objetivo:** registrar misa y catequesis por separado, en menos tiempo que en papel, sin depender de la señal, y producir para el párroco una evidencia verificable de quién estuvo en misa.

## Usuarios

- **Catequista:** escanea carnés en misa y pasa la lista de catequesis de cualquier grupo.
- **Coordinación (o quien la tenga delegada):** define las sesiones, corrige la asistencia y revisa las alertas.
- **Supervisión (párroco, Madre Concepción):** consulta la asistencia a misa directamente con su cuenta.
- **Familia:** consulta la asistencia de su hijo.

## Historias de usuario

- **HU-301.** Como catequista, quiero escanear el carné de cualquier niño que llegue a las bancas, para registrar su asistencia a misa en segundos.
- **HU-302.** Como catequista, quiero que en catequesis todos aparezcan presentes y solo desmarcar a los ausentes, para pasar lista en menos de 2 minutos.
- **HU-303.** Como catequista, quiero pasar la lista de un grupo cuyo catequista faltó, para que ningún grupo quede sin registro.
- **HU-304.** Como catequista, quiero registrar la asistencia aunque no haya señal, para no depender del piso en el que estoy.
- **HU-305.** Como párroco, quiero ver quién estuvo en cada misa, con hora y quién lo registró, para que la cifra deje de ser una impresión.
- **HU-306.** Como apoderado, quiero ver si mi hijo llegó a misa y a catequesis cada domingo.

## Requisitos funcionales

### RF-301 Sesiones dominicales
- El sistema deberá registrar por cada niño y domingo dos asistencias independientes: misa y catequesis.
- El sistema deberá permitir a la coordinación marcar un domingo como sin misa o sin catequesis, y no deberá contar ausencias en esa sesión.
- El sistema deberá permitir que un niño figure presente en misa y ausente en catequesis el mismo domingo, y viceversa.

### RF-302 Misa por escaneo de carné
- El sistema deberá asignar a cada niño inscrito un carné con un código QR único que no contenga ni muestre datos sensibles.
- El sistema deberá permitir escanear carnés solo a un catequista con sesión iniciada.
- Cuando un catequista escanea un carné durante la ventana de la misa, el sistema deberá registrar al niño presente en misa, sin importar la hora de llegada dentro de esa ventana, con la hora del celular, la hora de llegada al servidor y el catequista que lo registró.
- Donde el niño pertenezca a un grupo del catequista, el sistema deberá mostrar su nombre al escanear.
- Donde el niño no pertenezca a un grupo del catequista, el sistema deberá confirmar "registrado" sin mostrar su nombre ni ningún otro dato.
- Si se escanea dos veces el mismo carné en la misma misa, entonces el sistema deberá conservar un solo registro de presencia e indicar que ya estaba registrado.
- Cuando el escaneo es correcto, el sistema deberá confirmarlo de forma visible en menos de un segundo; la confirmación sonora será opcional.

### RF-303 Validación del carné
- Mientras haya conexión, si el carné no corresponde a un niño activo del ciclo, entonces el sistema deberá rechazarlo y avisarlo al catequista.
- Mientras no haya conexión, el sistema deberá guardar el código escaneado y validarlo al sincronizar.
- Si al sincronizar un código resulta inválido o de un niño inactivo, entonces el sistema deberá descartarlo como asistencia y avisar a la coordinación, sin perderlo de forma silenciosa.

### RF-304 Registro manual de respaldo
- Si un niño no trae su carné o el carné no se puede leer, entonces el sistema deberá permitir registrar su asistencia a misa buscándolo por nombre entre los niños de los grupos del catequista, y marcar ese registro como manual.
- El sistema deberá mostrar en los reportes cuántos registros de misa fueron manuales.

### RF-305 Ausencia en misa
- Cuando termina la ventana de la misa, el sistema deberá considerar ausente en misa a todo niño activo sin escaneo ni registro manual de esa misa.

### RF-306 Lista de catequesis
- El sistema deberá permitir a cualquier catequista pasar la lista de catequesis de cualquier grupo.
- Cuando un catequista abre la lista de catequesis de un grupo un domingo, el sistema deberá mostrar a todos los niños activos del grupo como presentes y permitir marcar ausentes con un toque.
- Cuando el catequista confirma la lista, el sistema deberá registrar la asistencia de catequesis de todo el grupo con la hora y el catequista.
- Mientras la lista no esté confirmada, el sistema no deberá contar a nadie como presente ni ausente en catequesis.
- Cuando un niño llega después de confirmada la lista, el sistema deberá permitir cambiarlo a presente según RF-309.

### RF-307 Sin conexión
- Mientras no haya conexión, el sistema deberá permitir registrar la misa y las listas de catequesis completas.
- Cuando vuelve la conexión, el sistema deberá enviar los registros pendientes sin intervención del catequista y sin perder ni duplicar ninguno, salvo los que lleguen después del cierre del ciclo, que se descartan (spec 008, RF-802).
- El sistema deberá mostrar al catequista cuántos registros tiene pendientes de envío.

### RF-308 Registros concurrentes
- Si dos catequistas registran al mismo niño en la misma misa o sesión, entonces el sistema deberá conservar un solo registro y dejar constancia de ambos registradores.
- Si un registro dice presente y otro ausente para la misma sesión de catequesis, entonces el sistema deberá considerar al niño presente y avisar a la coordinación.

### RF-309 Corrección
- Mientras no termine el domingo, el sistema deberá permitir al catequista que hizo un registro corregirlo, conservando el valor anterior y la hora del cambio.
- Cuando termina el domingo, el sistema deberá permitir corregir solo a la coordinación, exigiendo un motivo y conservando el valor anterior, quién lo cambió y cuándo.

### RF-310 Revisión cruzada
- Cuando se confirma la lista de catequesis de un grupo, el sistema deberá avisar a la coordinación de los niños registrados en misa y ausentes en catequesis ese domingo, para que confirme que no hubo un carné presentado por otra persona.

### RF-311 Cómputo de falta
- El sistema deberá contar una falta por domingo solo cuando el niño estuvo ausente tanto en misa como en catequesis.
- El sistema deberá registrar la ausencia en una sola de las dos sesiones sin contarla como falta.
- El sistema deberá contar como una falta la inasistencia no justificada a una jornada (spec 005).
- Cuando se aprueba una justificación de esa fecha (spec 004), el sistema deberá dejar de contar la falta.

### RF-312 Reporte de misa
- El sistema deberá mostrar a la coordinación y a la supervisión, por fecha de misa, la lista de niños presentes con hora de registro, catequista registrador (con seudónimo si es menor) y tipo de registro (escaneo o manual).
- El sistema deberá mostrar en ese reporte el total de presentes frente al total de niños activos en esa fecha.

### RF-313 Actividades obligatorias
- El sistema deberá permitir registrar la asistencia a actividades obligatorias (jornadas, retiros, viacrucis, posadas, misas de precepto, Semana Santa) con el mismo escaneo o lista.

## Requisitos no funcionales

- **RNF-301 Más rápido que el papel.** Registrar la asistencia de un niño deberá tomar menos tiempo que en la lista en papel, medido en campo; la meta es menos de 2 minutos por grupo en catequesis (R6, R27).
- **RNF-302 Offline completo.** El registro completo de un domingo deberá funcionar sin señal (R19).
- **RNF-303 Pico dominical.** 50 catequistas registrando a la vez en una ventana de 30 minutos no deberán notar demoras (R22).
- **RNF-304 Datos mínimos.** Sincronizar un domingo completo de un grupo deberá consumir menos de 100 KB de datos móviles (R20).
- **RNF-305 Celulares modestos.** Toda la toma de asistencia deberá funcionar en un celular de gama baja, incluida la lectura del QR con poca luz (R18).
- **RNF-306 Nómina sin conexión.** Cada celular de catequista deberá tener disponible sin conexión la nómina (nombre y grupo) de todos los niños activos, para pasar la lista de cualquier grupo; el resto de los datos operativos, solo de sus propios grupos.
- **RNF-307 Escaneo discreto.** El escaneo de un carné de otro grupo no deberá mostrar el nombre del niño en pantalla, aunque esté en la nómina.

## Casos límite

- Niño que llega tarde a misa pero dentro de la ventana: cuenta como presente, con su hora.
- Niño que va a misa y no a catequesis: registrado, sin falta.
- Niño que no va a misa ni a catequesis: una falta.
- Niño escaneado que se va antes de que empiece la misa.
- Carné presentado por un hermano: lo detecta la revisión cruzada si el niño no aparece en catequesis.
- Carné perdido o deteriorado: se reimprime y el anterior queda invalidado.
- Catequista que falta: otro catequista pasa la lista de su grupo.
- Niño inscrito el mismo domingo, sin carné todavía: registro manual.
- Niño cambiado de grupo entre la última sincronización y el domingo.
- Celular que se apaga a mitad de la lista: lo registrado hasta ese momento no se pierde.
- Catequista que no recupera conexión hasta el domingo siguiente.
- Reloj del celular adelantado o atrasado: quedan la hora del celular y la de llegada al servidor.
- Domingo sin catequesis o sin misa (feriado o actividad especial).
- Corrección de un registro ya usado en una justificación o una alerta: se recalculan.

## Fuera de alcance

- Reconocimiento facial, biometría o fotos de los niños para verificar identidad.
- Que el niño o el apoderado registren su propia asistencia.
- Geolocalización como prueba de asistencia.
- Validar asistencia a misas de otra parroquia u otro horario.

## Criterios de finalización

- En una prueba de campo, un grupo completo registra misa y catequesis sin señal y los datos llegan íntegros al recuperarla.
- El tiempo medido por niño es menor que el de la lista en papel.
- Un catequista escanea el carné de un niño de otro grupo y ve "registrado" sin ningún dato del niño.
- Un catequista pasa la lista de un grupo que no es el suyo.
- Un niño ausente en misa y en catequesis suma una falta; ausente solo en una, no.
- El reporte de misa de un domingo coincide con los escaneos, muestra cuántos fueron manuales y lo consulta la supervisión sin intervención de la coordinación.
- Un código inválido escaneado sin conexión llega como aviso a la coordinación y no como asistencia.

## Dudas abiertas

- **[NECESITA ACLARACIÓN]** Ventana de la misa: ¿desde qué hora y hasta qué hora se aceptan escaneos? ¿La define la coordinación cada domingo?
- **[NECESITA ACLARACIÓN]** El contenido del QR depende del identificador del niño, pendiente en la spec 002.
- **[NECESITA ACLARACIÓN]** ¿Quién imprime y entrega los carnés y quién asume su costo?
- **[NECESITA ACLARACIÓN]** ¿Cuánto tiempo toma hoy pasar lista en papel? Es la línea base que hay que medir.
- **[NECESITA ACLARACIÓN]** ¿Qué hora marca el "fin del domingo" para el plazo de corrección del catequista?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R4 Misa y catequesis | RF-301, RF-305, RF-306, RF-311, RF-313 |
| R5 Misa verificable ante el párroco | RF-302, RF-303, RF-304, RF-308, RF-309, RF-310, RF-312 |
| R6 Más rápido que el papel | RF-302, RF-306, RNF-301 |
| R19, R20, R22 Offline, datos, picos | RF-307, RNF-302, RNF-303, RNF-304 |
