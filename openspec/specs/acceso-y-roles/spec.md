# Acceso, roles y protección de datos

## Purpose

Que cada persona entre con su propia credencial y vea exactamente lo que sus roles le permiten, que el equipo pueda operar un domingo sin la coordinación y que los datos de menores estén protegidos desde el diseño: mínimos, con consentimiento, con plazo de vida y con la identidad de los catequistas menores oculta. Administración gestiona cuentas, roles y ciclos; la coordinación ve y gestiona todos los grupos; el catequista opera los grupos asignados y puede tomar asistencia de cualquiera; la familia entra con un enlace personal y ve solo a sus hijos; la supervisión consulta en solo lectura. Una cuenta puede reunir varios roles y ve la unión de sus alcances. Inscripción, cuentas, roles, enlaces, delegación, consentimiento y condiciones se gestionan en línea.

## Requirements

### Requirement: RF-101 Exigir credencial personal válida

El sistema SHALL exigir una credencial personal válida para consultar o registrar cualquier dato: enlace personal más PIN para administración, coordinación, catequistas y supervisión (RF-111); enlace personal para familias (RF-110).

#### Scenario: Acceso con credencial válida

- **WHEN** una persona consulta o registra un dato con su credencial personal válida
- **THEN** el sistema permite la operación que su rol autoriza

### Requirement: RF-101 Negar el acceso sin revelar la cuenta

Si una persona intenta acceder sin credencial válida, el sistema SHALL negar el acceso sin revelar si la cuenta o el enlace existen.

#### Scenario: Credencial inválida

- **WHEN** una persona intenta acceder sin credencial válida
- **THEN** el sistema niega el acceso sin revelar si la cuenta o el enlace existen

### Requirement: RF-101 Impedir el acceso de una cuenta desactivada

Cuando una cuenta se desactiva, el sistema SHALL impedir su acceso en la siguiente interacción con el servidor.

#### Scenario: Cuenta desactivada

- **WHEN** una cuenta desactivada vuelve a interactuar con el servidor
- **THEN** el sistema impide su acceso

#### Scenario: Catequista que deja el equipo

- **WHEN** un catequista deja el equipo a mitad del ciclo
- **THEN** su cuenta se desactiva y sus registros conservan su seudónimo

### Requirement: RF-102 Asignar uno o más roles

El sistema SHALL permitir asignar a cada cuenta uno o más roles de administración, coordinación, catequista, familia y supervisión.

#### Scenario: Cuenta con un rol

- **WHEN** se asigna a una cuenta uno de los roles definidos
- **THEN** el sistema conserva ese rol para calcular su alcance

### Requirement: RF-102 Mostrar la unión de los alcances

Mientras una cuenta tenga varios roles, el sistema SHALL mostrarle la unión de los alcances de esos roles y nada más.

#### Scenario: HU-101 y cuenta con dos roles

- **WHEN** una cuenta tiene dos roles y consulta información
- **THEN** el sistema muestra la unión de los alcances de esos roles y nada más

#### Scenario: Catequista que también es apoderado

- **WHEN** un catequista también es apoderado de un niño inscrito
- **THEN** usa una sola cuenta con ambos roles y ve la unión de sus alcances

### Requirement: RF-102 Alcance del catequista

Mientras una cuenta tenga el rol catequista, el sistema SHALL mostrarle y permitirle registrar solo información de los niños de los grupos que tiene asignados, con dos excepciones de asistencia: escanear el carné de cualquier niño en misa sin ver sus datos y pasar la lista de catequesis de cualquier grupo (spec 003).

#### Scenario: HU-101 Ver solo el propio grupo

- **WHEN** un catequista entra con su cuenta
- **THEN** ve y registra solo a los niños de los grupos que tiene asignados

#### Scenario: Catequista asignado a dos grupos

- **WHEN** un catequista está asignado a dos grupos
- **THEN** ve ambos grupos y nada más

### Requirement: RF-102 Alcance de la familia

Mientras una cuenta tenga el rol familia, el sistema SHALL mostrarle solo a los niños de los que es apoderada.

#### Scenario: HU-104 Ver solo al propio hijo

- **WHEN** un apoderado entra con su enlace personal
- **THEN** ve solo la información de los niños de los que es apoderado, sin contraseña ni correo

### Requirement: RF-102 Alcance de supervisión

Mientras una cuenta tenga el rol supervisión, el sistema SHALL permitirle consultar, sin modificar, la asistencia, las justificaciones con su evidencia y la aptitud de todos los grupos.

#### Scenario: HU-107 Consulta del párroco

- **WHEN** el párroco consulta la asistencia y las evidencias con su cuenta
- **THEN** el sistema se las muestra en solo lectura, sin depender de que la coordinación se las envíe

#### Scenario: Supervisión intenta modificar

- **WHEN** una cuenta de supervisión intenta modificar asistencia, justificaciones o aptitud
- **THEN** el sistema rechaza la modificación

### Requirement: RF-102 Rechazar información fuera de alcance

Si una cuenta solicita información fuera de su alcance, el sistema SHALL rechazar la solicitud aunque se haga sin pasar por las pantallas habituales.

#### Scenario: Solicitud fuera de alcance

- **WHEN** una cuenta solicita información fuera de su alcance, aunque no use las pantallas habituales
- **THEN** el sistema rechaza la solicitud

### Requirement: RF-103 Mostrar faltas, justificaciones y avance

Cuando un catequista abre el perfil de un niño de su grupo, el sistema SHALL mostrarle sus faltas, justificaciones con su estado y su avance formativo, sin requerir intervención de la coordinación.

#### Scenario: HU-102 Consultar sin esperar a la coordinación

- **WHEN** un catequista abre el perfil de un niño de su grupo
- **THEN** el sistema muestra sus faltas, justificaciones con su estado y su avance formativo

### Requirement: RF-103 Mostrar avisos del grupo

El sistema SHALL mostrar a todos los catequistas de un grupo los avisos que la coordinación publique para ese grupo.

#### Scenario: Aviso publicado para el grupo

- **WHEN** la coordinación publica un aviso para un grupo
- **THEN** el sistema lo muestra a todos los catequistas de ese grupo

### Requirement: RF-104 Otorgar permisos durante la delegación

Cuando la coordinación delega sus funciones a un catequista indicando un periodo, el sistema SHALL otorgarle durante ese periodo exactamente los mismos permisos que la coordinación, incluidos los datos restringidos, sea mayor o menor de edad.

#### Scenario: HU-103 Delegar un domingo

- **WHEN** la coordinación delega sus funciones a un catequista de confianza e indica un periodo
- **THEN** durante ese periodo el delegado tiene exactamente los mismos permisos que la coordinación

#### Scenario: Delegación a un catequista menor de edad

- **WHEN** la coordinación delega en un catequista menor de edad
- **THEN** durante el periodo ve los datos restringidos de todos los niños

#### Scenario: Delegación solapada con el regreso

- **WHEN** la delegación sigue vigente y la coordinación ya regresó
- **THEN** ambos tienen permisos hasta que termine el periodo o la coordinación la revoque

### Requirement: RF-104 Retirar permisos al terminar el periodo

Cuando termina el periodo de delegación, el sistema SHALL retirar esos permisos automáticamente.

#### Scenario: Vencimiento de la delegación

- **WHEN** llega el fin del periodo de delegación
- **THEN** el sistema retira los permisos de coordinación sin un paso manual

### Requirement: RF-104 Retirar permisos al revocar

Cuando la coordinación revoca una delegación antes de su fin, el sistema SHALL retirar los permisos en la siguiente interacción del delegado con el servidor.

#### Scenario: Revocación anticipada

- **WHEN** la coordinación revoca una delegación antes de su fin y el delegado vuelve a interactuar con el servidor
- **THEN** el sistema retira esos permisos

### Requirement: RF-104 Registrar la delegación

El sistema SHALL registrar quién delegó, a quién, durante qué periodo y, si la hubo, la revocación.

#### Scenario: Constancia de la delegación

- **WHEN** la coordinación delega o revoca una delegación
- **THEN** el sistema registra quién delegó, a quién, el periodo y, si la hubo, la revocación

### Requirement: RF-105 Mostrar el seudónimo del catequista menor

Donde un catequista sea menor de edad, el sistema SHALL mostrar su seudónimo institucional en toda vista, reporte, exportación y registro de auditoría.

#### Scenario: HU-105 Seudónimo en lo que se muestra o exporta

- **WHEN** el sistema muestra, reporta, exporta o audita la acción de un catequista menor de edad
- **THEN** aparece su seudónimo institucional y no su identidad real

### Requirement: RF-105 Guardar la identidad real solo para administración

El sistema SHALL guardar la identidad real de un catequista separada de su seudónimo y mostrarla solo a administración.

#### Scenario: Identidad real

- **WHEN** alguien que no es administración consulta a un catequista menor de edad
- **THEN** el sistema no muestra su identidad real
- **WHEN** administración consulta a ese catequista
- **THEN** el sistema puede mostrar su identidad real, separada del seudónimo

### Requirement: RF-106 Registrar el consentimiento para inscribir

El sistema SHALL registrar el consentimiento informado del apoderado (quién, cuándo y sobre qué texto) como condición para completar la inscripción de un niño.

#### Scenario: HU-106 Consentimiento al inscribir

- **WHEN** un apoderado da su consentimiento informado al inscribir a su hijo
- **THEN** el sistema registra quién consintió, cuándo y sobre qué texto, y solo entonces permite completar la inscripción

#### Scenario: Inscripción sin consentimiento

- **WHEN** se intenta completar una inscripción sin consentimiento registrado
- **THEN** el sistema no la completa

### Requirement: RF-106 Eliminar datos al retirar el consentimiento

Cuando un apoderado retira su consentimiento, el sistema SHALL eliminar de inmediato la salud, la neurodivergencia, los documentos y las evidencias del niño, marcarlo como inactivo y conservar solo sus registros de asistencia anonimizados y, si ya recibió un sacramento, su constancia sacramental (spec 008, RF-805).

#### Scenario: HU-108 Retiro del consentimiento

- **WHEN** un apoderado retira su consentimiento
- **THEN** el sistema elimina de inmediato la salud, la neurodivergencia, los documentos y las evidencias del niño, lo marca inactivo y conserva la asistencia anonimizada y, si existe, la constancia sacramental

#### Scenario: Retiro con justificaciones pendientes

- **WHEN** el apoderado retira el consentimiento y hay justificaciones pendientes
- **THEN** el sistema elimina la evidencia y la justificación queda sin evidencia

### Requirement: RF-106 Informar que la constancia se conserva

El sistema SHALL informar en el texto del consentimiento que la constancia sacramental se conserva sin vencimiento.

#### Scenario: Texto del consentimiento

- **WHEN** el apoderado lee el texto del consentimiento
- **THEN** el texto informa que la constancia sacramental se conserva sin vencimiento

### Requirement: RF-107 Pedir solo los datos necesarios

El sistema SHALL pedir solo los datos necesarios para formar grupos y determinar la aptitud sacramental.

#### Scenario: Datos de inscripción

- **WHEN** se inscribe a un niño
- **THEN** el sistema pide solo los datos necesarios para formar grupos y determinar la aptitud sacramental

### Requirement: RF-107 Tratar datos restringidos

El sistema SHALL tratar salud, neurodivergencia y documentos de identidad como datos restringidos, visibles solo para la coordinación (y quien la tenga delegada) y los catequistas del grupo del niño.

#### Scenario: Consulta de un dato restringido

- **WHEN** la coordinación, su delegado o un catequista del grupo del niño consulta salud, neurodivergencia o un documento de identidad
- **THEN** el sistema se lo muestra
- **WHEN** otra cuenta lo consulta
- **THEN** el sistema no se lo muestra

### Requirement: RF-107 Mostrar evidencia a supervisión

El sistema SHALL mostrar a supervisión la evidencia de las justificaciones, aunque contenga datos de salud, como autorización expresa de su rol.

#### Scenario: Evidencia con datos de salud

- **WHEN** supervisión consulta la evidencia de una justificación que contiene datos de salud
- **THEN** el sistema se la muestra por la autorización expresa de su rol

### Requirement: RF-108 Anonimizar a los dos años

Cuando se cumplen 2 años desde el cierre de un ciclo, el sistema SHALL anonimizar los datos personales de ese ciclo y conservar solo los registros agregados de valor institucional y la constancia sacramental (spec 008).

#### Scenario: Plazo de retención cumplido

- **WHEN** se cumplen 2 años desde el cierre de un ciclo
- **THEN** el sistema anonimiza los datos personales de ese ciclo y conserva los registros agregados y la constancia sacramental

### Requirement: RF-109 Auditar datos restringidos

El sistema SHALL registrar quién creó, modificó o consultó datos restringidos y cuándo.

#### Scenario: Acceso a un dato restringido

- **WHEN** alguien crea, modifica o consulta un dato restringido
- **THEN** el sistema registra quién fue y cuándo

### Requirement: RF-110 Generar enlace personal de familia

Cuando la coordinación da de alta a un apoderado, el sistema SHALL generar un enlace personal para él, que se envía por los canales que ya usa la familia.

#### Scenario: Alta de un apoderado

- **WHEN** la coordinación da de alta a un apoderado
- **THEN** el sistema genera un enlace personal para enviarlo por los canales que ya usa la familia

#### Scenario: Varios hijos con un solo enlace

- **WHEN** un apoderado tiene varios hijos inscritos
- **THEN** un solo enlace ve a todos sus hijos

#### Scenario: Dos apoderados del mismo niño

- **WHEN** un niño tiene dos apoderados
- **THEN** cada uno tiene su propio enlace

### Requirement: RF-110 Revocar y regenerar el enlace de familia

Cuando la coordinación revoca el enlace de un apoderado, el sistema SHALL rechazar cualquier acceso posterior con ese enlace y permitir generar uno nuevo.

#### Scenario: Enlace revocado

- **WHEN** la coordinación revoca el enlace de un apoderado
- **THEN** el sistema rechaza cualquier acceso posterior con ese enlace y permite generar uno nuevo

#### Scenario: Enlace reenviado a otra persona

- **WHEN** el enlace de familia llega a otra persona y aún no se ha revocado
- **THEN** quien lo tenga entra como ese apoderado

#### Scenario: Quitar el acceso a un apoderado

- **WHEN** hay que quitar el acceso a un apoderado y el niño tiene otro apoderado
- **THEN** se revoca el enlace de ese apoderado y el del otro sigue funcionando

### Requirement: RF-110 No enviar mensajes con costo

El sistema SHALL NOT enviar mensajes con costo por usuario para identificar a las familias.

#### Scenario: Identificar a una familia

- **WHEN** el sistema identifica a una familia para entregarle su enlace
- **THEN** no envía mensajes con costo por usuario

### Requirement: RF-110 Vigencia del enlace de familia

El enlace de familia SHALL NOT vencer por sí solo: dura hasta que se revoque o hasta el cierre del ciclo si el niño no se reinscribe (spec 008, RF-802).

#### Scenario: Enlace vigente

- **WHEN** el enlace de familia no ha sido revocado y el niño sigue inscrito en el ciclo
- **THEN** el enlace sigue permitiendo el acceso

### Requirement: RF-111 Generar enlace del equipo

Cuando la coordinación da de alta a un miembro del equipo, el sistema SHALL generar un enlace personal que se envía por los canales que ya usa, sin requerir correo ni teléfono.

#### Scenario: Alta de un miembro del equipo

- **WHEN** la coordinación da de alta a un miembro del equipo
- **THEN** el sistema genera un enlace personal para enviarlo por los canales que ya usa, sin correo ni teléfono

### Requirement: RF-111 Fijar el PIN al abrir el enlace

Cuando la persona abre su enlace por primera vez, el sistema SHALL pedirle que fije un PIN de 4 a 6 dígitos y quedar asociado a ese celular.

#### Scenario: Primer uso del enlace

- **WHEN** un miembro del equipo abre su enlace por primera vez
- **THEN** el sistema le pide un PIN de 4 a 6 dígitos y asocia la credencial a ese celular

#### Scenario: Catequista menor sin correo propio

- **WHEN** un catequista menor de edad usa el celular de su madre
- **THEN** entra con su enlace y su PIN, sin correo

### Requirement: RF-111 Revocar el enlace por pérdida o olvido

Cuando la persona pierde el celular u olvida su PIN, el sistema SHALL permitir a la coordinación revocar su enlace y generar uno nuevo; el enlace anterior deja de funcionar en la siguiente interacción con el servidor.

#### Scenario: Celular perdido o PIN olvidado

- **WHEN** la persona pierde el celular u olvida su PIN y la coordinación revoca el enlace
- **THEN** el sistema genera uno nuevo y el anterior deja de funcionar en la siguiente interacción con el servidor

#### Scenario: Celular perdido o robado

- **WHEN** se pierde o roban el celular y la coordinación revoca el enlace
- **THEN** los registros que ese celular no había enviado se pierden

### Requirement: RF-111 Bloquear tras cinco PIN incorrectos

Si se ingresa un PIN incorrecto 5 veces seguidas, el sistema SHALL bloquear el acceso en ese celular hasta que se emita un enlace nuevo.

#### Scenario: Cinco PIN incorrectos

- **WHEN** se ingresa un PIN incorrecto 5 veces seguidas en un celular
- **THEN** el sistema bloquea el acceso en ese celular hasta que se emita un enlace nuevo

### Requirement: RF-112 Desbloquear sin conexión

Mientras no haya conexión, el sistema SHALL permitir desbloquear la aplicación con el PIN y registrar asistencia durante un máximo de 14 días desde la última renovación de la sesión.

#### Scenario: Sesión sin señal dentro de los 14 días

- **WHEN** no hay conexión y no pasaron 14 días desde la última renovación de la sesión
- **THEN** el PIN desbloquea la aplicación y permite registrar asistencia

#### Scenario: Sesión vencida sin señal en plena misa

- **WHEN** no hay señal en plena misa y no pasaron 14 días desde la última renovación
- **THEN** el PIN desbloquea la aplicación

### Requirement: RF-112 Renovar la sesión al reconectar

Cuando vuelve la conexión, el sistema SHALL renovar la sesión antes de enviar los registros pendientes.

#### Scenario: Vuelve la conexión

- **WHEN** vuelve la conexión y hay registros pendientes
- **THEN** el sistema renueva la sesión antes de enviarlos

### Requirement: RF-112 Rechazar registros de un enlace revocado

Si al reconectar la cuenta o el enlace fueron revocados, el sistema SHALL rechazar los registros pendientes de ese celular y avisar a la coordinación de cuántos fueron rechazados.

#### Scenario: Reconexión con enlace revocado

- **WHEN** al reconectar la cuenta o el enlace fueron revocados
- **THEN** el sistema rechaza los registros pendientes de ese celular y avisa a la coordinación de cuántos fueron

### Requirement: RF-112 Impedir registros tras 14 días

Cuando se cumplen los 14 días sin renovar, el sistema SHALL impedir nuevos registros hasta conectarse.

#### Scenario: Catorce días sin renovar

- **WHEN** se cumplen 14 días sin renovar la sesión
- **THEN** el sistema impide nuevos registros hasta que haya conexión

### Requirement: RNF-101 Datos sensibles fuera del celular

Salud, neurodivergencia, documentos de identidad y evidencias SHALL NOT quedar guardados en el celular; solo se consultan con conexión.

#### Scenario: Consulta sin conexión de un dato sensible

- **WHEN** no hay conexión y alguien intenta ver salud, neurodivergencia, un documento de identidad o una evidencia
- **THEN** esos datos no están guardados en el celular

### Requirement: RNF-102 Borrar datos al cerrar sesión

Al cerrar sesión, el sistema SHALL borrar del celular todos los datos de niños excepto los registros pendientes de envío, que se enviarán la próxima vez que esa misma cuenta inicie sesión y no podrán verse desde otra cuenta.

#### Scenario: Cierre de sesión con asistencias sin enviar

- **WHEN** se cierra sesión y hay asistencias sin enviar
- **THEN** el celular conserva solo esos registros hasta el próximo inicio de sesión de la misma cuenta
- **WHEN** otra cuenta usa ese celular
- **THEN** no puede ver esos registros pendientes

### Requirement: RNF-103 Canal cifrado

Toda comunicación con el servidor SHALL viajar cifrada.

#### Scenario: Comunicación con el servidor

- **WHEN** el sistema se comunica con el servidor
- **THEN** esa comunicación viaja cifrada

### Requirement: RNF-104 Costo cero

La gestión de cuentas y enlaces SHALL NOT generar costo por usuario ni por mensaje enviado (R23).

#### Scenario: Gestionar una cuenta o un enlace

- **WHEN** se crea una cuenta, se genera un enlace o se envía ese enlace
- **THEN** la operación no genera costo por usuario ni por mensaje

### Requirement: RNF-106 Disponibilidad y alerta operativa

Aprobado 2026-11-09. El sistema SHALL sondear APIM → Functions → PostgreSQL por HTTPS cada 300 segundos desde tres ubicaciones con timeout de 30 segundos, sin redirecciones y validando TLS, HTTP 200 y `{"estado":"disponible"}`. La API técnica separada GET `/estado/` SHALL NOT exigir credencial personal ni suscripción y SHALL NOT devolver datos personales, errores internos ni secretos. Functions SHALL seguir exigiendo clave de host y `/v1` SHALL mantener sus controles. PostgreSQL se comprueba con SELECT 1 de solo lectura y tiempo acotado, sin paquetes ni modelo nuevos. La respuesta SHALL ser 200/disponible o 503/no_disponible con no-store.

#### Scenario: Caída sin usuarios conectados

- **WHEN** la sonda falla desde al menos dos ubicaciones
- **THEN** Azure Monitor evalúa cada minuto sobre una ventana de cinco minutos y envía alerta al correo operativo configurable, por defecto el responsable del presupuesto
- **AND** un 401/403, redirección o contenido incorrecto no cuenta como disponibilidad

#### Scenario: Recuperación y evidencia

- **WHEN** se recupera la disponibilidad
- **THEN** la alerta se resuelve automáticamente y notifica mediante el grupo de acción
- **AND** la recepción real se acredita con un ensayo controlado en Azure, no con pruebas locales

#### Scenario: Despliegue seguro y coste

- **WHEN** se publican las políticas finales de producción
- **THEN** se habilitan sonda y alerta sin secretos en la configuración de la sonda ni cambios a autenticación de datos
- **AND** se revisa previamente el coste regional de pruebas estándar y alertas; no se usan SMS ni se promete coste cero
- **AND** el alcance no certifica todos los flujos autenticados ni Blob Storage

### Requirement: RNF-105 Administración mínima

Crear cuentas, asignar grupos, generar enlaces y delegar SHALL poder hacerse desde el celular, sin intervención técnica (R24).

#### Scenario: Administración desde el celular

- **WHEN** la coordinación crea una cuenta, asigna un grupo, genera un enlace o delega
- **THEN** puede hacerlo desde el celular, sin intervención técnica
