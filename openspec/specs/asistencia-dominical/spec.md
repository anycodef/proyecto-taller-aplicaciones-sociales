# Asistencia dominical

## Purpose

Registrar misa y catequesis por separado, en menos tiempo que en papel, sin depender de la señal, y producir para el párroco una evidencia verificable de quién estuvo en misa. El catequista escanea carnés en misa y pasa la lista de catequesis de cualquier grupo. La coordinación define las sesiones, corrige la asistencia y revisa las alertas. La supervisión consulta la asistencia a misa con su cuenta. La familia consulta la asistencia de su hijo.

## Requirements

### Requirement: RF-301 Dos asistencias por domingo

El sistema SHALL registrar por cada niño y domingo dos asistencias independientes: misa y catequesis.

#### Scenario: Misa y catequesis el mismo domingo

- **WHEN** se registra el domingo de un niño
- **THEN** el sistema guarda por separado su asistencia a misa y su asistencia a catequesis

#### Scenario: HU-306 Asistencia del hijo

- **WHEN** un apoderado consulta un domingo de su hijo
- **THEN** el sistema muestra si llegó a misa y si llegó a catequesis

### Requirement: RF-301 Domingo sin misa o sin catequesis

El sistema SHALL permitir a la coordinación marcar un domingo como sin misa o sin catequesis, y SHALL NOT contar ausencias en esa sesión.

#### Scenario: Domingo sin catequesis o sin misa

- **WHEN** la coordinación marca un domingo como sin misa o sin catequesis
- **THEN** el sistema no cuenta ausencias en esa sesión

### Requirement: RF-301 Presente en una sesión y ausente en la otra

El sistema SHALL permitir que un niño figure presente en misa y ausente en catequesis el mismo domingo, y viceversa.

#### Scenario: Misa sin catequesis

- **WHEN** un niño va a misa y no a catequesis el mismo domingo
- **THEN** el sistema lo registra presente en misa y ausente en catequesis

### Requirement: RF-302 Carné con QR único

El sistema SHALL asignar a cada niño inscrito un carné con un código QR único que no contenga ni muestre datos sensibles.

#### Scenario: Carné de un niño inscrito

- **WHEN** el sistema asigna el carné de un niño inscrito
- **THEN** el QR es único y no contiene ni muestra datos sensibles

#### Scenario: Carné perdido o deteriorado

- **WHEN** se reimprime un carné perdido o deteriorado
- **THEN** el carné anterior queda invalidado

### Requirement: RF-302 Escanear solo con sesión iniciada

El sistema SHALL permitir escanear carnés solo a un catequista con sesión iniciada.

#### Scenario: Escaneo sin sesión

- **WHEN** alguien sin sesión de catequista intenta escanear un carné
- **THEN** el sistema no registra la asistencia

### Requirement: RF-302 Registrar presente al escanear

Cuando un catequista escanea un carné durante la ventana de la misa, el sistema SHALL registrar al niño presente en misa, sin importar la hora de llegada dentro de esa ventana, con la hora del celular, la hora de llegada al servidor y el catequista que lo registró.

#### Scenario: HU-301 Escanear en las bancas

- **WHEN** un catequista con sesión iniciada escanea el carné de un niño durante la ventana de la misa
- **THEN** el sistema lo registra presente en misa, con la hora del celular, la hora de llegada al servidor y el catequista que lo registró

#### Scenario: Llega tarde dentro de la ventana

- **WHEN** un niño llega tarde a misa pero dentro de la ventana y se escanea su carné
- **THEN** cuenta como presente, con su hora

#### Scenario: Escaneado que se va antes de la misa

- **WHEN** un niño ya fue escaneado y se va antes de que empiece la misa
- **THEN** el sistema conserva el registro de ese escaneo con su hora

#### Scenario: Reloj del celular adelantado o atrasado

- **WHEN** el reloj del celular está adelantado o atrasado al escanear
- **THEN** el sistema conserva la hora del celular y la hora de llegada al servidor

### Requirement: RF-302 Mostrar el nombre del propio grupo

Donde el niño pertenezca a un grupo del catequista, el sistema SHALL mostrar su nombre al escanear.

#### Scenario: Niño del propio grupo

- **WHEN** el catequista escanea el carné de un niño de un grupo suyo
- **THEN** el sistema muestra el nombre del niño

### Requirement: RF-302 Confirmar sin datos de otro grupo

Donde el niño no pertenezca a un grupo del catequista, el sistema SHALL confirmar "registrado" sin mostrar su nombre ni ningún otro dato.

#### Scenario: Niño de otro grupo

- **WHEN** un catequista escanea el carné de un niño de otro grupo
- **THEN** el sistema confirma "registrado" sin mostrar su nombre ni ningún otro dato

### Requirement: RF-302 Un solo registro por misa

Si se escanea dos veces el mismo carné en la misma misa, el sistema SHALL conservar un solo registro de presencia e indicar que ya estaba registrado.

#### Scenario: Segundo escaneo en la misma misa

- **WHEN** se escanea dos veces el mismo carné en la misma misa
- **THEN** el sistema conserva un solo registro de presencia e indica que ya estaba registrado

### Requirement: RF-302 Confirmar el escaneo en menos de un segundo

Cuando el escaneo es correcto, el sistema SHALL confirmarlo de forma visible en menos de un segundo; la confirmación sonora será opcional.

#### Scenario: Escaneo correcto

- **WHEN** el escaneo de un carné es correcto
- **THEN** el sistema lo confirma de forma visible en menos de un segundo, y el sonido es opcional

### Requirement: RF-303 Rechazar un carné inválido con conexión

Mientras haya conexión, si el carné no corresponde a un niño activo del ciclo, el sistema SHALL rechazarlo y avisarlo al catequista.

#### Scenario: Carné ajeno al ciclo

- **WHEN** hay conexión y el carné no corresponde a un niño activo del ciclo
- **THEN** el sistema lo rechaza y avisa al catequista

### Requirement: RF-303 Guardar el código sin conexión

Mientras no haya conexión, el sistema SHALL guardar el código escaneado y validarlo al sincronizar.

#### Scenario: Escaneo sin señal

- **WHEN** no hay conexión y se escanea un carné
- **THEN** el sistema guarda el código y lo valida al sincronizar

### Requirement: RF-303 Descartar un código inválido al sincronizar

Si al sincronizar un código resulta inválido o de un niño inactivo, el sistema SHALL descartarlo como asistencia y avisar a la coordinación, sin perderlo de forma silenciosa.

#### Scenario: Código inválido escaneado sin conexión

- **WHEN** al sincronizar un código resulta inválido o de un niño inactivo
- **THEN** el sistema lo descarta como asistencia y avisa a la coordinación

### Requirement: RF-304 Registro manual de respaldo

Si un niño no trae su carné o el carné no se puede leer, el sistema SHALL permitir registrar su asistencia a misa buscándolo por nombre entre los niños de los grupos del catequista, y marcar ese registro como manual.

#### Scenario: Niño inscrito el mismo domingo sin carné

- **WHEN** un niño no trae su carné, el carné no se puede leer, o está inscrito ese domingo y aún no tiene carné
- **THEN** el catequista puede registrarlo por nombre entre los niños de sus grupos y el sistema marca el registro como manual

### Requirement: RF-304 Contar registros manuales

El sistema SHALL mostrar en los reportes cuántos registros de misa fueron manuales.

#### Scenario: Reporte con registros manuales

- **WHEN** se consulta un reporte de misa
- **THEN** el sistema muestra cuántos registros fueron manuales

### Requirement: RF-305 Ausencia al cerrar la ventana

Cuando termina la ventana de la misa, el sistema SHALL considerar ausente en misa a todo niño activo sin escaneo ni registro manual de esa misa.

#### Scenario: Sin escaneo ni registro manual

- **WHEN** termina la ventana de la misa y un niño activo no tiene escaneo ni registro manual
- **THEN** el sistema lo considera ausente en misa

### Requirement: RF-306 Pasar lista de cualquier grupo

El sistema SHALL permitir a cualquier catequista pasar la lista de catequesis de cualquier grupo.

#### Scenario: HU-303 Catequista que faltó

- **WHEN** el catequista de un grupo falta
- **THEN** otro catequista puede pasar la lista de ese grupo

### Requirement: RF-306 Lista con todos presentes

Cuando un catequista abre la lista de catequesis de un grupo un domingo, el sistema SHALL mostrar a todos los niños activos del grupo como presentes y permitir marcar ausentes con un toque.

#### Scenario: HU-302 Pasar lista desmarcando ausentes

- **WHEN** un catequista abre la lista de catequesis de un grupo un domingo
- **THEN** el sistema muestra a todos los niños activos como presentes y permite marcar ausentes con un toque

### Requirement: RF-306 Confirmar la lista del grupo

Cuando el catequista confirma la lista, el sistema SHALL registrar la asistencia de catequesis de todo el grupo con la hora y el catequista.

#### Scenario: Lista confirmada

- **WHEN** el catequista confirma la lista de catequesis
- **THEN** el sistema registra la asistencia de todo el grupo con la hora y el catequista

### Requirement: RF-306 No contar una lista sin confirmar

Mientras la lista no esté confirmada, el sistema SHALL NOT contar a nadie como presente ni ausente en catequesis.

#### Scenario: Lista abierta

- **WHEN** la lista de catequesis de un grupo aún no está confirmada
- **THEN** el sistema no cuenta a nadie como presente ni ausente en catequesis

### Requirement: RF-306 Llegada después de confirmar

Cuando un niño llega después de confirmada la lista, el sistema SHALL permitir cambiarlo a presente según RF-309.

#### Scenario: Llega después de la lista

- **WHEN** un niño llega después de confirmada la lista de catequesis
- **THEN** el sistema permite cambiarlo a presente según la corrección de RF-309

### Requirement: RF-307 Registrar sin conexión

Mientras no haya conexión, el sistema SHALL permitir registrar la misa y las listas de catequesis completas.

#### Scenario: HU-304 Domingo sin señal

- **WHEN** no hay señal durante la misa o la catequesis
- **THEN** el sistema permite registrar la misa y las listas de catequesis completas

### Requirement: RF-307 Enviar pendientes al reconectar

Cuando vuelve la conexión, el sistema SHALL enviar los registros pendientes sin intervención del catequista y sin perder ni duplicar ninguno, salvo los que lleguen después del cierre del ciclo, que se descartan (spec 008, RF-802).

#### Scenario: Recuperar la señal

- **WHEN** vuelve la conexión y hay registros pendientes de un domingo aún abierto
- **THEN** el sistema los envía sin intervención del catequista, sin perder ni duplicar ninguno

#### Scenario: Celular apagado a mitad de la lista

- **WHEN** el celular se apaga a mitad de la lista
- **THEN** lo registrado hasta ese momento no se pierde

#### Scenario: Conexión recién el domingo siguiente

- **WHEN** el catequista no recupera conexión hasta el domingo siguiente y el ciclo sigue abierto
- **THEN** el sistema envía los registros pendientes sin perderlos ni duplicarlos

### Requirement: RF-307 Mostrar pendientes de envío

El sistema SHALL mostrar al catequista cuántos registros tiene pendientes de envío.

#### Scenario: Registros sin enviar

- **WHEN** el catequista tiene registros pendientes de envío
- **THEN** el sistema le muestra cuántos son

### Requirement: RF-308 Un solo registro entre catequistas

Si dos catequistas registran al mismo niño en la misma misa o sesión, el sistema SHALL conservar un solo registro y dejar constancia de ambos registradores.

#### Scenario: Dos registros de la misma presencia

- **WHEN** dos catequistas registran al mismo niño en la misma misa o sesión
- **THEN** el sistema conserva un solo registro y deja constancia de ambos registradores

### Requirement: RF-308 Presente si hay conflicto en catequesis

Si un registro dice presente y otro ausente para la misma sesión de catequesis, el sistema SHALL considerar al niño presente y avisar a la coordinación.

#### Scenario: Presente y ausente a la vez

- **WHEN** para la misma sesión de catequesis un registro dice presente y otro ausente
- **THEN** el sistema considera al niño presente y avisa a la coordinación

### Requirement: RF-309 Corregir antes de que termine el domingo

Mientras no termine el domingo, el sistema SHALL permitir al catequista que hizo un registro corregirlo, conservando el valor anterior y la hora del cambio.

#### Scenario: Corrección del propio catequista

- **WHEN** el catequista que hizo un registro lo corrige antes de que termine el domingo
- **THEN** el sistema acepta la corrección y conserva el valor anterior y la hora del cambio

### Requirement: RF-309 Corregir después la coordinación

Cuando termina el domingo, el sistema SHALL permitir corregir solo a la coordinación, exigiendo un motivo y conservando el valor anterior, quién lo cambió y cuándo.

#### Scenario: Corrección después del domingo

- **WHEN** termina el domingo y la coordinación corrige un registro con un motivo
- **THEN** el sistema guarda la corrección, el valor anterior, quién la hizo y cuándo
- **WHEN** un catequista intenta corregirlo después del domingo
- **THEN** el sistema no lo permite

#### Scenario: Corrección usada en una justificación o una alerta

- **WHEN** se corrige un registro ya usado en una justificación o una alerta
- **THEN** el sistema recalcula esa justificación o esa alerta

### Requirement: RF-310 Avisar misa sin catequesis

Cuando se confirma la lista de catequesis de un grupo, el sistema SHALL avisar a la coordinación de los niños registrados en misa y ausentes en catequesis ese domingo, para que confirme que no hubo un carné presentado por otra persona.

#### Scenario: Carné presentado por un hermano

- **WHEN** un niño quedó registrado en misa y ausente en catequesis al confirmar la lista
- **THEN** el sistema avisa a la coordinación para que confirme que el carné no lo presentó otra persona

### Requirement: RF-311 Falta solo si faltó a ambas sesiones

El sistema SHALL contar una falta por domingo solo cuando el niño estuvo ausente tanto en misa como en catequesis.

#### Scenario: Ausente en misa y en catequesis

- **WHEN** un niño no va a misa ni a catequesis el mismo domingo
- **THEN** el sistema cuenta una falta

### Requirement: RF-311 Ausencia en una sola sesión

El sistema SHALL registrar la ausencia en una sola de las dos sesiones sin contarla como falta.

#### Scenario: Ausente solo en una sesión

- **WHEN** un niño falta solo a misa o solo a catequesis
- **THEN** el sistema registra esa ausencia y no la cuenta como falta

### Requirement: RF-311 Falta por jornada

El sistema SHALL contar como una falta la inasistencia no justificada a una jornada (spec 005).

#### Scenario: Jornada sin asistencia

- **WHEN** un niño no asiste a una jornada y esa inasistencia no está justificada
- **THEN** el sistema cuenta una falta

### Requirement: RF-311 Dejar de contar una falta justificada

Cuando se aprueba una justificación de esa fecha (spec 004), el sistema SHALL dejar de contar la falta.

#### Scenario: Justificación aprobada

- **WHEN** se aprueba la justificación de la fecha de una falta
- **THEN** el sistema deja de contar esa falta

### Requirement: RF-312 Reporte de misa

El sistema SHALL mostrar a la coordinación y a la supervisión, por fecha de misa, la lista de niños presentes con hora de registro, catequista registrador (con seudónimo si es menor) y tipo de registro (escaneo o manual).

#### Scenario: HU-305 Cifra verificable de la misa

- **WHEN** el párroco o la coordinación consultan una fecha de misa
- **THEN** el sistema muestra quién estuvo, con hora de registro, catequista registrador (seudónimo si es menor) y si el registro fue por escaneo o manual

### Requirement: RF-312 Total de presentes

El sistema SHALL mostrar en ese reporte el total de presentes frente al total de niños activos en esa fecha.

#### Scenario: Totales del domingo

- **WHEN** se abre el reporte de una misa
- **THEN** el sistema muestra el total de presentes frente al total de niños activos en esa fecha

### Requirement: RF-313 Actividades obligatorias

El sistema SHALL permitir registrar la asistencia a actividades obligatorias (jornadas, retiros, viacrucis, posadas, misas de precepto, Semana Santa) con el mismo escaneo o lista.

#### Scenario: Asistencia a una actividad

- **WHEN** se toma asistencia a una jornada, retiro, viacrucis, posada, misa de precepto o Semana Santa
- **THEN** el sistema la registra con el mismo escaneo o la misma lista de la catequesis

### Requirement: RNF-301 Más rápido que el papel

Registrar la asistencia de un niño SHALL tomar menos tiempo que en la lista en papel, medido en campo; la meta es menos de 2 minutos por grupo en catequesis (R6, R27).

#### Scenario: Lista de catequesis en menos de dos minutos

- **WHEN** un catequista pasa la lista de catequesis de un grupo
- **THEN** el registro toma menos de 2 minutos y menos tiempo que la lista en papel

### Requirement: RNF-302 Offline completo

El registro completo de un domingo SHALL funcionar sin señal (R19).

#### Scenario: Domingo completo sin señal

- **WHEN** un grupo registra misa y catequesis sin señal
- **THEN** el registro completo funciona y, al recuperar la señal, los datos llegan íntegros

### Requirement: RNF-303 Pico dominical

50 catequistas registrando a la vez en una ventana de 30 minutos SHALL NOT notar demoras (R22).

#### Scenario: Cincuenta catequistas a la vez

- **WHEN** 50 catequistas registran a la vez durante 30 minutos
- **THEN** no notan demoras

### Requirement: RNF-304 Datos mínimos

Sincronizar un domingo completo de un grupo SHALL consumir menos de 100 KB de datos móviles (R20).

#### Scenario: Sincronizar un grupo

- **WHEN** se sincroniza un domingo completo de un grupo
- **THEN** la sincronización consume menos de 100 KB de datos móviles

### Requirement: RNF-305 Celulares modestos

Toda la toma de asistencia SHALL funcionar en un celular de gama baja, incluida la lectura del QR con poca luz (R18).

#### Scenario: QR con poca luz

- **WHEN** un catequista lee un QR con poca luz en un celular de gama baja
- **THEN** la toma de asistencia funciona

### Requirement: RNF-306 Nómina sin conexión

Cada celular de catequista SHALL tener disponible sin conexión la nómina (nombre y grupo) de todos los niños activos, para pasar la lista de cualquier grupo; el resto de los datos operativos, solo de sus propios grupos.

#### Scenario: Lista de otro grupo sin señal

- **WHEN** un catequista pasa la lista de un grupo que no es el suyo y no hay señal
- **THEN** el celular tiene la nómina de nombre y grupo de todos los niños activos, y el resto de los datos operativos solo de sus grupos

#### Scenario: Cambio de grupo entre sincronizaciones

- **WHEN** un niño cambia de grupo entre la última sincronización y el domingo
- **THEN** el celular usa la nómina ya sincronizada hasta la próxima sincronización

### Requirement: RNF-307 Escaneo discreto

El escaneo de un carné de otro grupo SHALL NOT mostrar el nombre del niño en pantalla, aunque esté en la nómina.

#### Scenario: Nombre en la nómina y no en el escaneo

- **WHEN** se escanea el carné de un niño de otro grupo cuyo nombre está en la nómina
- **THEN** la pantalla no muestra su nombre
